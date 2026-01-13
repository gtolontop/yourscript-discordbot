import { SlashCommandBuilder } from "discord.js";
import { useQueue } from "discord-player";
import type { Command } from "../../types/index.js";
import { errorMessage, successMessage } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Arrête la musique et vide la queue"),

  async execute(interaction) {
    const queue = useQueue(interaction.guildId!);

    if (!queue) {
      return interaction.reply({
        ...errorMessage({ description: "Aucune musique en cours." }),
        ephemeral: true,
      });
    }

    queue.delete();

    await interaction.reply(
      successMessage({ description: "Musique arrêtée et queue vidée." })
    );
  },
} satisfies Command;
