import { SlashCommandBuilder, GuildMember } from "discord.js";
import { useQueue } from "discord-player";
import type { Command } from "../../types/index.js";
import type { Bot } from "../../client/Bot.js";
import { errorMessage, successMessage } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Skip the currently playing track"),

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

    const currentTrack = queue.currentTrack;
    queue.node.skip();

    await interaction.reply(
      successMessage({
        description: `Skipped **${currentTrack?.title ?? "the current track"}**.`,
      }),
    );
  },
} satisfies Command;
