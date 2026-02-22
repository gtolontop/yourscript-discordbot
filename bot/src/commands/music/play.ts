import {
  SlashCommandBuilder,
  GuildMember,
  ChannelType,
  type VoiceBasedChannel,
} from "discord.js";
import { useMainPlayer } from "discord-player";
import type { Command } from "../../types/index.js";
import type { Bot } from "../../client/Bot.js";
import { createMessage, errorMessage } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song or add it to the queue")
    .addStringOption((option) =>
      option
        .setName("query")
        .setDescription("URL or search term")
        .setRequired(true),
    ),

  async execute(interaction, client) {
    const member = interaction.member as GuildMember;
    const voiceChannel = member.voice.channel as VoiceBasedChannel | null;

    if (!voiceChannel) {
      return interaction.reply({
        ...errorMessage({
          description: "You must be in a voice channel to play music.",
        }),
        ephemeral: true,
      });
    }

    const query = interaction.options.getString("query", true);
    await interaction.deferReply();

    const player = useMainPlayer();

    try {
      const result = await player.play(voiceChannel, query, {
        nodeOptions: {
          metadata: interaction,
          leaveOnEmpty: false,
          leaveOnEnd: false,
          leaveOnStop: false,
        },
      });

      const track = result.track;

      await interaction.editReply(
        createMessage({
          title: "Added to Queue",
          description: `**[${track.title}](${track.url})**\nDuration: ${track.duration}`,
          color: "Success",
          footer: `Requested by ${interaction.user.tag}`,
        }),
      );
    } catch (error) {
      console.error("Play error:", error);
      await interaction.editReply(
        errorMessage({
          description:
            "Could not play that track. Make sure the URL or search term is valid.",
        }),
      );
    }
  },
} satisfies Command;
