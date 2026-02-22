import { ActivityType, REST, Routes } from "discord.js";
import type { Event } from "../types/index.js";
import { Bot } from "../client/Bot.js";
import { logger } from "../utils/logger.js";

export default {
  name: "clientReady",
  once: true,

  async execute(client: Bot) {
    logger.info(`Logged in as ${client.user?.tag}`);
    logger.info(`Serving ${client.guilds.cache.size} guild(s)`);

    // Deploy slash commands to Discord API
    try {
      const commands = client.commands.map((cmd) => cmd.data.toJSON());
      const rest = new REST().setToken(client.token!);

      await rest.put(Routes.applicationCommands(client.user!.id), {
        body: commands,
      });

      logger.info(`Deployed ${commands.length} slash command(s)`);
    } catch (error) {
      logger.error("Failed to deploy commands:", error);
    }

    // Set bot status from backend config
    try {
      const botConfig = await client.api.getBotConfig();

      if (botConfig?.status_type && botConfig?.status_text) {
        const activityTypes: Record<string, ActivityType> = {
          playing: ActivityType.Playing,
          watching: ActivityType.Watching,
          listening: ActivityType.Listening,
          competing: ActivityType.Competing,
          streaming: ActivityType.Streaming,
        };

        const activityType = activityTypes[botConfig.status_type];

        if (activityType !== undefined) {
          if (botConfig.status_type === "streaming" && botConfig.status_url) {
            client.user?.setActivity({
              name: botConfig.status_text,
              type: activityType,
              url: botConfig.status_url,
            });
          } else {
            client.user?.setActivity({
              name: botConfig.status_text,
              type: activityType,
            });
          }
        }

        logger.info(
          `Restored status: ${botConfig.status_type} - ${botConfig.status_text}`,
        );
      } else {
        // Default status
        client.user?.setActivity({
          name: "your server",
          type: ActivityType.Watching,
        });
      }
    } catch (error) {
      logger.error("Failed to restore status:", error);
      client.user?.setActivity({
        name: "your server",
        type: ActivityType.Watching,
      });
    }
  },
} satisfies Event<"clientReady">;
