import { SlashCommandBuilder } from "discord.js";
import { useQueue } from "discord-player";
import type { Command } from "../../types/index.js";
import type { Bot } from "../../client/Bot.js";
import { createMessage, errorMessage } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Show the current music queue"),

  async execute(interaction, client) {
    const queue = useQueue(interaction.guildId!);

    if (!queue?.isPlaying()) {
      return interaction.reply({
        ...errorMessage({ description: "There is no music currently playing." }),
        ephemeral: true,
      });
    }

    const currentTrack = queue.currentTrack;
    const tracks = queue.tracks.toArray().slice(0, 10);

    let description = `**Now Playing:**\n[${currentTrack?.title}](${currentTrack?.url}) - ${currentTrack?.duration}\n\n`;

    if (tracks.length > 0) {
      description += "**Up Next:**\n";
      description += tracks
        .map(
          (track, i) =>
            `${i + 1}. [${track.title}](${track.url}) - ${track.duration}`,
        )
        .join("\n");

      if (queue.tracks.size > 10) {
        description += `\n\n*...and ${queue.tracks.size - 10} more*`;
      }
    } else {
      description += "*No upcoming tracks in the queue*";
    }

    await interaction.reply(
      createMessage({
        title: `Queue (${queue.tracks.size + 1} tracks)`,
        description,
        color: "Primary",
      }),
    );
  },
} satisfies Command;
