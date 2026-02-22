import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  GuildMember,
} from "discord.js";
import type { Command } from "../../types/index.js";
import {
  errorMessage,
  successMessage,
  canModerate,
  botCanModerate,
} from "../../utils/index.js";

/**
 * Parses a human-readable duration string into milliseconds.
 * Supported formats: 30s, 5m, 1h, 1d, 7d, combinations like 1d12h, etc.
 */
function parseDuration(input: string): number | null {
  const regex = /(\d+)\s*(s|sec|m|min|h|hr|d|day|w|week)/gi;
  let totalMs = 0;
  let matched = false;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(input)) !== null) {
    matched = true;
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case "s":
      case "sec":
        totalMs += value * 1000;
        break;
      case "m":
      case "min":
        totalMs += value * 60 * 1000;
        break;
      case "h":
      case "hr":
        totalMs += value * 60 * 60 * 1000;
        break;
      case "d":
      case "day":
        totalMs += value * 24 * 60 * 60 * 1000;
        break;
      case "w":
      case "week":
        totalMs += value * 7 * 24 * 60 * 60 * 1000;
        break;
    }
  }

  if (!matched) return null;

  // Discord timeout maximum is 28 days
  const maxTimeout = 28 * 24 * 60 * 60 * 1000;
  if (totalMs > maxTimeout) return null;
  if (totalMs <= 0) return null;

  return totalMs;
}

/**
 * Formats milliseconds into a human-readable duration string.
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours % 24 > 0) parts.push(`${hours % 24}h`);
  if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
  if (seconds % 60 > 0 && days === 0) parts.push(`${seconds % 60}s`);

  return parts.join(" ") || "0s";
}

export default {
  data: new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Timeout (mute) a user")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) =>
      opt
        .setName("user")
        .setDescription("The user to mute")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("duration")
        .setDescription("Duration of the mute (e.g. 30m, 1h, 1d, 7d)")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("Reason for the mute"),
    ),

  async execute(interaction, client) {
    const target = interaction.options.getUser("user", true);
    const durationStr = interaction.options.getString("duration", true);
    const reason =
      interaction.options.getString("reason") ?? "No reason provided";
    const member = interaction.member as GuildMember;
    const targetMember = interaction.guild?.members.cache.get(target.id);

    if (!targetMember) {
      return interaction.reply({
        ...errorMessage({
          description: "This user is not in the server.",
        }),
        ephemeral: true,
      });
    }

    if (!canModerate(member, targetMember)) {
      return interaction.reply({
        ...errorMessage({
          description:
            "You cannot mute this user (role hierarchy).",
        }),
        ephemeral: true,
      });
    }

    if (!botCanModerate(targetMember)) {
      return interaction.reply({
        ...errorMessage({
          description:
            "I cannot mute this user (role hierarchy).",
        }),
        ephemeral: true,
      });
    }

    const durationMs = parseDuration(durationStr);
    if (!durationMs) {
      return interaction.reply({
        ...errorMessage({
          description:
            "Invalid duration. Use formats like `30s`, `5m`, `1h`, `1d`, `7d`. Maximum is 28 days.",
        }),
        ephemeral: true,
      });
    }

    try {
      await targetMember.timeout(
        durationMs,
        `${reason} | By ${interaction.user.tag}`,
      );

      await interaction.reply(
        successMessage({
          title: "User Muted",
          description: `**${target.tag}** has been muted for **${formatDuration(durationMs)}**.\n**Reason:** ${reason}`,
        }),
      );
    } catch (error) {
      console.error("Mute error:", error);
      await interaction.reply({
        ...errorMessage({
          description: "Failed to mute this user.",
        }),
        ephemeral: true,
      });
    }
  },
} satisfies Command;
