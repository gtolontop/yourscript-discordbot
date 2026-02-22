import { SlashCommandBuilder, GuildMember } from "discord.js";
import { useQueue } from "discord-player";
import type { Command } from "../../types/index.js";
import type { Bot } from "../../client/Bot.js";
import { errorMessage, successMessage } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop the music and clear the queue"),

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

    if (!queue) {
      return interaction.reply({
        ...errorMessage({ description: "There is no music currently playing." }),
        ephemeral: true,
      });
    }

    queue.delete();

    await interaction.reply(
      successMessage({
        description: "Music stopped and the queue has been cleared.",
      }),
    );
  },
} satisfies Command;
