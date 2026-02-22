import { type Message, type TextChannel } from "discord.js";
import type { Event } from "../types/index.js";
import { Bot } from "../client/Bot.js";
import { logger } from "../utils/logger.js";

export default {
  name: "messageCreate",

  async execute(client: Bot, message: Message) {
    // Ignore bots
    if (message.author.bot) return;
    if (!message.guild) return;

    const guildId = message.guild.id;

    // Add XP on message (cooldown handled by the backend)
    try {
      const xpAmount = Math.floor(Math.random() * 10) + 5; // 5-14 XP per message
      const result = await client.api.addXp(message.author.id, xpAmount);

      // If the user leveled up, send a level-up message
      if (result.leveled_up) {
        try {
          const config = await client.api.getGuildConfig(guildId);

          if (config.level_up_channel) {
            const channel = message.guild.channels.cache.get(
              config.level_up_channel,
            ) as TextChannel | undefined;

            if (channel) {
              const levelUpMessage = config.level_up_message
                .replace(/{user}/g, message.author.toString())
                .replace(/{level}/g, result.level.toString())
                .replace(/{xp}/g, result.xp.toString());

              await channel.send(levelUpMessage);
            }
          }
        } catch (error) {
          logger.error("Failed to send level-up message:", error);
        }
      }
    } catch {
      // XP add failed (likely on cooldown), silently ignore
    }

    // Update ticket last activity if the message is in a ticket channel
    try {
      const tickets = await client.api.listTickets(guildId, "open");

      const ticket = tickets.tickets.find(
        (t) => t.channel_id === message.channel.id,
      );

      if (ticket) {
        // The backend will handle updating the last_activity timestamp
        // We just need to note that this channel has activity
        // For now, we fetch the ticket to trigger any activity-related logic
        await client.api.getTicket(guildId, ticket.id);
      }
    } catch {
      // Silently ignore ticket activity update failures
    }
  },
} satisfies Event<"messageCreate">;
