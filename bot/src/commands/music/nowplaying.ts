import { SlashCommandBuilder } from "discord.js";
import { useQueue } from "discord-player";
import type { Command } from "../../types/index.js";
import type { Bot } from "../../client/Bot.js";
import { createMessage, errorMessage } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("nowplaying")
    .setDescription("Show information about the currently playing track"),

  async execute(interaction, client) {
    const queue = useQueue(interaction.guildId!);

    if (!queue?.isPlaying()) {
      return interaction.reply({
        ...errorMessage({ description: "There is no music currently playing." }),
        ephemeral: true,
      });
    }

    const track = queue.currentTrack!;
    const progress = queue.node.createProgressBar();

    await interaction.reply(
      createMessage({
        title: "Now Playing",
        description: [
          `**[${track.title}](${track.url})**`,
          `**Author:** ${track.author}`,
          `**Duration:** ${track.duration}`,
          "",
          progress,
        ].join("\n"),
        color: "Primary",
        footer: `Requested by ${track.requestedBy?.tag ?? "Unknown"}`,
      }),
    );
  },
} satisfies Command;
