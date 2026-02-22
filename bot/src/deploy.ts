import "dotenv/config";
import { REST, Routes } from "discord.js";
import { readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { Command } from "./types/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function deployCommands(): Promise<void> {
  const commands: unknown[] = [];
  const commandsPath = join(__dirname, "commands");

  let categories: string[];
  try {
    categories = readdirSync(commandsPath).filter((entry) =>
      statSync(join(commandsPath, entry)).isDirectory(),
    );
  } catch {
    console.error("No commands directory found");
    process.exit(1);
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

      if (command?.data) {
        commands.push(command.data.toJSON());
        console.log(`Loaded command: ${command.data.name}`);
      }
    }
  }

  const token = process.env["DISCORD_TOKEN"];
  const clientId = process.env["CLIENT_ID"];
  const guildId = process.env["GUILD_ID"];

  if (!token || !clientId) {
    console.error(
      "Missing DISCORD_TOKEN or CLIENT_ID in environment variables",
    );
    process.exit(1);
  }

  const rest = new REST().setToken(token);

  try {
    if (guildId) {
      // Guild-scoped deployment (instant, for development)
      console.log(
        `\nDeploying ${commands.length} commands to guild ${guildId}...`,
      );
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commands,
      });
      console.log("Commands deployed to guild successfully!");
    } else {
      // Global deployment (can take up to 1 hour to propagate)
      console.log(
        `\nDeploying ${commands.length} commands globally...`,
      );
      await rest.put(Routes.applicationCommands(clientId), {
        body: commands,
      });
      console.log(
        "Commands deployed globally (may take a few minutes to appear).",
      );
    }
  } catch (error) {
    console.error("Failed to deploy commands:", error);
    process.exit(1);
  }
}

deployCommands();
