import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { getVoiceConnection } from "@discordjs/voice";
import type { Command } from "../../types/index.js";
import { errorMessage, successMessage, warningMessage } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("247")
    .setDescription("Toggle 24/7 mode (stays in the channel)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction, client) {
    const guildId = interaction.guildId!;
    const connection = getVoiceConnection(guildId);

    // Check if bot is in a voice channel
    if (!connection) {
      return interaction.reply({
        ...errorMessage({
          description: "I must be in a voice channel to toggle 24/7 mode.\nUse `/join` first.",
        }),
        ephemeral: true,
      });
    }

    // Get current voice session from DB
    const session = await client.db.voiceSession.findUnique({
      where: { id: guildId },
    });

    if (session?.is247) {
      // Disable 24/7 mode
      await client.db.voiceSession.update({
        where: { id: guildId },
        data: { is247: false },
      });

      return interaction.reply(
        warningMessage({
          title: "24/7 Mode Disabled",
          description: "The bot will leave the channel when the queue is empty.",
        })
      );
    }

    // Enable 24/7 mode - get current channel from connection
    const channelId = connection.joinConfig.channelId!;

    // Ensure guild exists in DB first
    await client.db.guild.upsert({
      where: { id: guildId },
      create: { id: guildId },
      update: {},
    });

    // Create or update voice session
    await client.db.voiceSession.upsert({
      where: { id: guildId },
      create: {
        id: guildId,
        channelId: channelId,
        is247: true,
      },
      update: {
        channelId: channelId,
        is247: true,
      },
    });

    const channel = interaction.guild?.channels.cache.get(channelId);

    await interaction.reply(
      successMessage({
        title: "24/7 Mode Enabled",
        description: `I will stay connected to **${channel?.name ?? "this channel"}** permanently.\nUse \`/247\` again to disable.`,
      })
    );
  },
} satisfies Command;
