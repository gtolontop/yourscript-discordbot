import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { getVoiceConnection } from "@discordjs/voice";
import type { Command } from "../../types/index.js";
import { errorMessage, successMessage, warningMessage } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("247")
    .setDescription("Active/désactive le mode 24/7 (reste dans le salon)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction, client) {
    const guildId = interaction.guildId!;
    const connection = getVoiceConnection(guildId);

    // Check if bot is in a voice channel
    if (!connection) {
      return interaction.reply({
        ...errorMessage({
          description: "Je dois être dans un salon vocal pour activer/désactiver le mode 24/7.\nUtilise `/join` d'abord.",
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
          title: "Mode 24/7 désactivé",
          description: "Le bot quittera le salon quand la queue sera vide.",
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
        title: "Mode 24/7 activé",
        description: `Je resterai connecté à **${channel?.name ?? "ce salon"}** en permanence.\nUtilise \`/247\` à nouveau pour désactiver.`,
      })
    );
  },
} satisfies Command;
