import { GuildMember, TextChannel, EmbedBuilder } from "discord.js";
import type { Event } from "../types/index.js";
import { LogService } from "../services/LogService.js";
import { Colors } from "../utils/index.js";

const event: Event<"guildMemberAdd"> = {
  name: "guildMemberAdd",
  async execute(client, member: GuildMember) {
    const logService = new LogService(client);
    await logService.logMemberJoin(member);

    const guildId = member.guild.id;

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
      console.error("Failed to add auto-roles:", error);
    }

    // Welcome message
    try {
      const config = await client.db.guild.findUnique({
        where: { id: guildId },
      });

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
      console.error("Failed to send welcome message:", error);
    }
  },
};

export default event;
