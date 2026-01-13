import { SlashCommandBuilder } from "discord.js";
import { getVoiceConnection } from "@discordjs/voice";
import { useQueue } from "discord-player";
import type { Command } from "../../types/index.js";
import { errorMessage, successMessage } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("leave")
    .setDescription("Quitte le salon vocal"),

  async execute(interaction, client) {
    const guildId = interaction.guildId!;
    const connection = getVoiceConnection(guildId);
    const queue = useQueue(guildId);

    if (!connection) {
      return interaction.reply({
        ...errorMessage({ description: "Je ne suis pas dans un salon vocal." }),
        ephemeral: true,
      });
    }

    // Clear queue if exists
    if (queue) {
      queue.delete();
    }

    connection.destroy();

    // Remove voice session from DB
    await client.db.voiceSession.delete({
      where: { id: guildId },
    }).catch(() => {}); // Ignore if doesn't exist

    await interaction.reply(
      successMessage({ description: "Déconnecté du salon vocal." })
    );
  },
} satisfies Command;
