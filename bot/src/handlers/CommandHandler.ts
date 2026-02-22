import { readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { Bot } from "../client/Bot.js";
import type { Command } from "../types/index.js";
import { logger } from "../utils/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function loadCommands(client: Bot): Promise<void> {
  const commandsPath = join(__dirname, "..", "commands");
  let categories: string[];

  try {
    categories = readdirSync(commandsPath).filter((entry) =>
      statSync(join(commandsPath, entry)).isDirectory(),
    );
  } catch {
    logger.warn("No commands directory found, skipping command loading");
    return;
  }

  for (const category of categories) {
    const categoryPath = join(commandsPath, category);
    const commandFiles = readdirSync(categoryPath).filter(
      (file) => file.endsWith(".ts") || file.endsWith(".js"),
    );

    for (const file of commandFiles) {
      const filePath = join(categoryPath, file);
      const module = await import(`file://${filePath}`);
      const command: Command = module.default;

      if (command?.data?.name) {
        client.commands.set(command.data.name, command);
        logger.debug(`Loaded command: ${command.data.name}`);
      } else {
        logger.warn(`Invalid command file: ${file}`);
      }
    }
  }

  logger.info(`Loaded ${client.commands.size} commands`);
}
