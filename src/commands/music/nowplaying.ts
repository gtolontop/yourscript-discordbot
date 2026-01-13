import { SlashCommandBuilder } from "discord.js";
import { useQueue } from "discord-player";
import type { Command } from "../../types/index.js";
import { createMessage, errorMessage } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("nowplaying")
    .setDescription("Affiche la musique en cours"),

  async execute(interaction) {
    const queue = useQueue(interaction.guildId!);

    if (!queue?.isPlaying()) {
      return interaction.reply({
        ...errorMessage({ description: "Aucune musique en cours." }),
        ephemeral: true,
      });
    }

    const track = queue.currentTrack!;
    const progress = queue.node.createProgressBar();

    await interaction.reply(
      createMessage({
        title: "En cours de lecture",
        description: `**[${track.title}](${track.url})**\nArtiste: ${track.author}\n\n${progress}`,
        color: "Primary",
        footer: `Demandé par ${track.requestedBy?.tag ?? "Inconnu"}`,
      })
    );
  },
} satisfies Command;
