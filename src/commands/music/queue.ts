import { SlashCommandBuilder } from "discord.js";
import { useQueue } from "discord-player";
import type { Command } from "../../types/index.js";
import { createMessage, errorMessage } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Affiche la queue de musique"),

  async execute(interaction) {
    const queue = useQueue(interaction.guildId!);

    if (!queue?.isPlaying()) {
      return interaction.reply({
        ...errorMessage({ description: "Aucune musique en cours." }),
        ephemeral: true,
      });
    }

    const currentTrack = queue.currentTrack;
    const tracks = queue.tracks.toArray().slice(0, 10);

    let description = `**En cours:**\n[${currentTrack?.title}](${currentTrack?.url}) - ${currentTrack?.duration}\n\n`;

    if (tracks.length > 0) {
      description += "**Prochaines:**\n";
      description += tracks
        .map((track, i) => `${i + 1}. [${track.title}](${track.url}) - ${track.duration}`)
        .join("\n");

      if (queue.tracks.size > 10) {
        description += `\n\n*...et ${queue.tracks.size - 10} autres*`;
      }
    } else {
      description += "*Aucune musique dans la queue*";
    }

    await interaction.reply(
      createMessage({
        title: `Queue (${queue.tracks.size + 1} titres)`,
        description,
        color: "Primary",
      })
    );
  },
} satisfies Command;
