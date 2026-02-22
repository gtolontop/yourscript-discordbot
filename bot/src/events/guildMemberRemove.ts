import { type GuildMember, type TextChannel, EmbedBuilder } from "discord.js";
import type { Event } from "../types/index.js";
import { Bot } from "../client/Bot.js";
import { logger } from "../utils/logger.js";

export default {
  name: "guildMemberRemove",

  async execute(client: Bot, member: GuildMember) {
    const guildId = member.guild.id;

    // Fetch guild config
    let config;
    try {
      config = await client.api.getGuildConfig(guildId);
    } catch (error) {
      logger.error("Failed to fetch guild config for member leave:", error);
      return;
    }

    // Send leave message
    try {
      if (config.leave_channel && config.leave_message) {
        const channel = member.guild.channels.cache.get(
          config.leave_channel,
        ) as TextChannel | undefined;

        if (channel) {
          // Replace placeholders
          const message = config.leave_message
            .replace(/{user}/g, member.user.username)
            .replace(/{username}/g, member.user.username)
            .replace(/{tag}/g, member.user.tag)
            .replace(/{server}/g, member.guild.name)
            .replace(/{memberCount}/g, member.guild.memberCount.toString());

          // Check if message should be sent as an embed
          if (config.leave_message.startsWith("{embed}")) {
            const text = message.replace("{embed}", "").trim();
            const embed = new EmbedBuilder()
              .setDescription(text)
              .setColor(0xed4245)
              .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
              .setTimestamp();

            await channel.send({ embeds: [embed] });
          } else {
            await channel.send(message);
          }
        }
      }
    } catch (error) {
      logger.error("Failed to send leave message:", error);
    }
  },
} satisfies Event<"guildMemberRemove">;
