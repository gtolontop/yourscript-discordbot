import "dotenv/config";
import { Bot } from "./client/Bot.js";
import { loadCommands, loadEvents, loadComponents } from "./handlers/index.js";
import { logger } from "./utils/index.js";

const client = new Bot();

async function main() {
  logger.info("Starting bot...");

  // Load handlers
  await loadEvents(client);
  await loadCommands(client);
  await loadComponents(client);

  // Start the bot
  const token = process.env["DISCORD_TOKEN"];
  if (!token) {
    logger.error("DISCORD_TOKEN is not set in environment variables");
    process.exit(1);
  }

  await client.start(token);
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Shutting down...");
  await client.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down...");
  await client.stop();
  process.exit(0);
});

main().catch((error) => {
  logger.error("Failed to start bot:", error);
  process.exit(1);
});
