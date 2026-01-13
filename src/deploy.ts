import "dotenv/config";
import { REST, Routes } from "discord.js";
import { readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { Command } from "./types/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function deployCommands() {
  const commands: unknown[] = [];
  const commandsPath = join(__dirname, "commands");
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

      if (command?.data) {
        commands.push(command.data.toJSON());
        console.log(`✓ Loaded command: ${command.data.name}`);
      }
    }
  }

  const token = process.env["DISCORD_TOKEN"];
  const clientId = process.env["CLIENT_ID"];

  if (!token || !clientId) {
    console.error("Missing DISCORD_TOKEN or CLIENT_ID in environment variables");
    process.exit(1);
  }

  const rest = new REST().setToken(token);

  try {
    console.log(`\nDeploying ${commands.length} commands globally...`);

    await rest.put(Routes.applicationCommands(clientId), {
      body: commands,
    });

    console.log("✓ Commands deployed globally (peut prendre quelques minutes pour apparaître)");
  } catch (error) {
    console.error("Failed to deploy commands:", error);
    process.exit(1);
  }
}

deployCommands();
