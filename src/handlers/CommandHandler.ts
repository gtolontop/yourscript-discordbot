import { readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { Bot } from "../client/Bot.js";
import type { Command } from "../types/index.js";
import { logger } from "../utils/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function loadCommands(client: Bot): Promise<void> {
  const commandsPath = join(__dirname, "..", "commands");
  const categories = readdirSync(commandsPath);

  for (const category of categories) {
    const categoryPath = join(commandsPath, category);
    const commandFiles = readdirSync(categoryPath).filter(
      (file) => file.endsWith(".ts") || file.endsWith(".js")
    );

    for (const file of commandFiles) {
      const filePath = join(categoryPath, file);
      const module = await import(`file://${filePath}`);
      const command: Command = module.default;

      if (command?.data?.name) {
        client.commands.set(command.data.name, command);
        logger.info(`  Loaded command: /${command.data.name} [${category}]`);
      } else {
        logger.warn(`  Invalid command file: ${file}`);
      }
    }
  }

  logger.info(`Loaded ${client.commands.size} commands`);
}
