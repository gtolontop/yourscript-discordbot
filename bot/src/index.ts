import { config } from "dotenv";
config();

import { Bot } from "./client/Bot.js";
import { SelfBot } from "./selfbot/SelfBot.js";
import { loadHandlers } from "./handlers/index.js";
import { logger } from "./utils/logger.js";

const bot = new Bot();
const selfbot = new SelfBot();

async function main() {
  const token = process.env["DISCORD_TOKEN"];

  if (!token) {
    logger.error("DISCORD_TOKEN is not set in environment variables");
    process.exit(1);
  }

  // Load all command, event, and component handlers
  await loadHandlers(bot);
  logger.info("Handlers loaded");

  // Start the main bot
  await bot.start(token);
  logger.info("Bot started");

  // Start the selfbot (non-blocking, will log warning if no token)
  selfbot.start().catch((error) => {
    logger.warn("Selfbot failed to start:", error);
  });
}

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Shutting down...");
  await bot.stop();
  await selfbot.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down...");
  await bot.stop();
  await selfbot.stop();
  process.exit(0);
});

main().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});
