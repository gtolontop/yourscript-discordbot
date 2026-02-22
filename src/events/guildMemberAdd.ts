import { GuildMember, TextChannel, EmbedBuilder } from "discord.js";
import type { Event } from "../types/index.js";
import { LogService } from "../services/LogService.js";
import { Colors } from "../utils/index.js";
import { logger } from "../utils/index.js";

const event: Event<"guildMemberAdd"> = {
  name: "guildMemberAdd",
  async execute(client, member: GuildMember) {
    logger.event(`Member joined: ${member.user.tag} (${member.id}) | ${member.guild.name}`);

    const logService = new LogService(client);
    await logService.logMemberJoin(member);

    const guildId = member.guild.id;

    // Fetch config once
    const config = await client.db.guild.findUnique({
      where: { id: guildId },
    });

    // Auto-roles
    try {
      const autoRoles = await client.db.autoRole.findMany({
        where: { guildId },
      });

      if (autoRoles.length > 0) {
        const roleIds = autoRoles.map((ar) => ar.roleId);
        await member.roles.add(roleIds).catch(() => {});
      }
    } catch (error) {
      logger.error(`Failed to add auto-roles for ${member.user.tag}:`, error);
    }

    // Ghost ping
    try {
      if (config?.ghostPingChannels) {
        const channelIds: string[] = JSON.parse(config.ghostPingChannels);

        for (const channelId of channelIds) {
          const channel = member.guild.channels.cache.get(channelId) as TextChannel;
          if (channel) {
            const msg = await channel.send(`${member}`);
            await msg.delete().catch(() => {});
          }
        }
      }
    } catch (error) {
      logger.error(`Failed to send ghost pings for ${member.user.tag}:`, error);
    }

    // Welcome message
    try {
      if (config?.welcomeChannel && config?.welcomeMessage) {
        const channel = member.guild.channels.cache.get(config.welcomeChannel) as TextChannel;
        if (channel) {
          // Replace placeholders
          const message = config.welcomeMessage
            .replace(/{user}/g, member.toString())
            .replace(/{username}/g, member.user.username)
            .replace(/{tag}/g, member.user.tag)
            .replace(/{server}/g, member.guild.name)
            .replace(/{memberCount}/g, member.guild.memberCount.toString());

          // Check if message is an embed format (starts with {embed})
          if (config.welcomeMessage.startsWith("{embed}")) {
            const text = message.replace("{embed}", "").trim();
            const embed = new EmbedBuilder()
              .setDescription(text)
              .setColor(Colors.Success)
              .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
              .setTimestamp();

            await channel.send({ embeds: [embed] });
          } else {
            await channel.send(message);
          }
        }
      }
    } catch (error) {
      logger.error(`Failed to send welcome message for ${member.user.tag}:`, error);
    }
  },
};

export default event;
