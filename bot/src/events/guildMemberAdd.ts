import { type GuildMember, type TextChannel, EmbedBuilder } from "discord.js";
import type { Event } from "../types/index.js";
import { Bot } from "../client/Bot.js";
import { logger } from "../utils/logger.js";

export default {
  name: "guildMemberAdd",

  async execute(client: Bot, member: GuildMember) {
    const guildId = member.guild.id;

    // Fetch guild config
    let config;
    try {
      config = await client.api.getGuildConfig(guildId);
    } catch (error) {
      logger.error("Failed to fetch guild config for member join:", error);
      return;
    }

    // Apply auto-roles
    try {
      const autoRoles = await client.api.getAutoRoles(guildId);

      if (autoRoles.length > 0) {
        const roleIds = autoRoles
          .filter((ar) => ar.role_type === "join")
          .map((ar) => ar.role_id);

        if (roleIds.length > 0) {
          await member.roles.add(roleIds).catch((error) => {
            logger.error("Failed to add auto-roles:", error);
          });
        }
      }
    } catch (error) {
      logger.error("Failed to fetch auto-roles:", error);
    }

    // Send welcome message
    try {
      if (config.welcome_channel && config.welcome_message) {
        const channel = member.guild.channels.cache.get(
          config.welcome_channel,
        ) as TextChannel | undefined;

        if (channel) {
          // Replace placeholders
          const message = config.welcome_message
            .replace(/{user}/g, member.toString())
            .replace(/{username}/g, member.user.username)
            .replace(/{tag}/g, member.user.tag)
            .replace(/{server}/g, member.guild.name)
            .replace(/{memberCount}/g, member.guild.memberCount.toString());

          // Check if message should be sent as an embed
          if (config.welcome_message.startsWith("{embed}")) {
            const text = message.replace("{embed}", "").trim();
            const embed = new EmbedBuilder()
              .setDescription(text)
              .setColor(0x57f287)
              .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
              .setTimestamp();

            await channel.send({ embeds: [embed] });
          } else {
            await channel.send(message);
          }
        }
      }
    } catch (error) {
      logger.error("Failed to send welcome message:", error);
    }
  },
} satisfies Event<"guildMemberAdd">;
