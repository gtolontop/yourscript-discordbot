import { SlashCommandBuilder } from "discord.js";
import { useQueue } from "discord-player";
import type { Command } from "../../types/index.js";
import { errorMessage, successMessage, warningMessage } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("pause")
    .setDescription("Met en pause / reprend la musique"),

  async execute(interaction) {
    const queue = useQueue(interaction.guildId!);

    if (!queue?.isPlaying()) {
      return interaction.reply({
        ...errorMessage({ description: "Aucune musique en cours." }),
        ephemeral: true,
      });
    }

    const wasPaused = queue.node.isPaused();
    queue.node.setPaused(!wasPaused);

    if (wasPaused) {
      await interaction.reply(
        successMessage({ description: "Musique reprise." })
      );
    } else {
      await interaction.reply(
        warningMessage({ description: "Musique en pause." })
      );
    }
  },
} satisfies Command;
