import { SlashCommandBuilder, GuildMember } from "discord.js";
import { useQueue } from "discord-player";
import type { Command } from "../../types/index.js";
import type { Bot } from "../../client/Bot.js";
import {
  errorMessage,
  successMessage,
  warningMessage,
} from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("pause")
    .setDescription("Pause or resume the current track"),

  async execute(interaction, client) {
    const member = interaction.member as GuildMember;

    if (!member.voice.channel) {
      return interaction.reply({
        ...errorMessage({
          description: "You must be in a voice channel to use this command.",
        }),
        ephemeral: true,
      });
    }

    const queue = useQueue(interaction.guildId!);

    if (!queue?.isPlaying()) {
      return interaction.reply({
        ...errorMessage({ description: "There is no music currently playing." }),
        ephemeral: true,
      });
    }

    const wasPaused = queue.node.isPaused();
    queue.node.setPaused(!wasPaused);

    if (wasPaused) {
      await interaction.reply(
        successMessage({ description: "Playback resumed." }),
      );
    } else {
      await interaction.reply(
        warningMessage({ description: "Playback paused." }),
      );
    }
  },
} satisfies Command;
