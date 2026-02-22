import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  TextChannel,
  ChannelType,
} from "discord.js";
import type { Command } from "../../types/index.js";
import { errorMessage, successMessage } from "../../utils/index.js";

/**
 * Parses a duration string into seconds for slowmode.
 * Supports: 0 (disable), 5s, 1m, 5m, 1h, 2h, 6h
 * Maximum Discord slowmode is 6 hours (21600 seconds).
 */
function parseSlowmode(input: string): number | null {
  // "0" or "off" disables slowmode
  if (input === "0" || input.toLowerCase() === "off") return 0;

  const regex = /^(\d+)\s*(s|sec|m|min|h|hr)$/i;
  const match = regex.exec(input.trim());
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  let seconds: number;
  switch (unit) {
    case "s":
    case "sec":
      seconds = value;
      break;
    case "m":
    case "min":
      seconds = value * 60;
      break;
    case "h":
    case "hr":
      seconds = value * 3600;
      break;
    default:
      return null;
  }

  // Discord maximum slowmode is 6 hours (21600 seconds)
  if (seconds < 0 || seconds > 21600) return null;

  return seconds;
}

/**
 * Formats seconds into a human-readable duration string.
 */
function formatSlowmode(seconds: number): string {
  if (seconds === 0) return "disabled";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0) parts.push(`${secs}s`);

  return parts.join(" ");
}

export default {
  data: new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("Set the slowmode for a channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((opt) =>
      opt
        .setName("duration")
        .setDescription(
          "Slowmode duration (e.g. 5s, 1m, 1h, or 0 to disable). Max 6h.",
        )
        .setRequired(true),
    )
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription(
          "The channel to set slowmode for (defaults to current channel)",
        )
        .addChannelTypes(ChannelType.GuildText),
    ),

  async execute(interaction, client) {
    const durationStr = interaction.options.getString("duration", true);
    const targetChannel = (interaction.options.getChannel("channel") ??
      interaction.channel) as TextChannel;

    if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
      return interaction.reply({
        ...errorMessage({
          description: "Slowmode can only be set on text channels.",
        }),
        ephemeral: true,
      });
    }

    const seconds = parseSlowmode(durationStr);
    if (seconds === null) {
      return interaction.reply({
        ...errorMessage({
          description:
            "Invalid duration. Use formats like `5s`, `1m`, `1h`, or `0` to disable. Maximum is 6 hours.",
        }),
        ephemeral: true,
      });
    }

    try {
      await targetChannel.setRateLimitPerUser(seconds);

      const channelMention =
        targetChannel.id === interaction.channelId
          ? "this channel"
          : `<#${targetChannel.id}>`;

      if (seconds === 0) {
        await interaction.reply(
          successMessage({
            title: "Slowmode Disabled",
            description: `Slowmode has been disabled for ${channelMention}.`,
          }),
        );
      } else {
        await interaction.reply(
          successMessage({
            title: "Slowmode Set",
            description: `Slowmode for ${channelMention} has been set to **${formatSlowmode(seconds)}**.`,
          }),
        );
      }
    } catch (error) {
      console.error("Slowmode error:", error);
      await interaction.reply({
        ...errorMessage({
          description: "Failed to set slowmode for this channel.",
        }),
        ephemeral: true,
      });
    }
  },
} satisfies Command;
