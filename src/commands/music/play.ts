import { SlashCommandBuilder, GuildMember, ChannelType, type VoiceBasedChannel } from "discord.js";
import { useMainPlayer } from "discord-player";
import type { Command } from "../../types/index.js";
import { createMessage, errorMessage, logger } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Joue une musique")
    .addStringOption((option) =>
      option
        .setName("query")
        .setDescription("URL ou nom de la musique")
        .setRequired(true)
    )
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Salon vocal (optionnel si tu es déjà dedans)")
        .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
    ),

  async execute(interaction, client) {
    const member = interaction.member as GuildMember;
    const specifiedChannel = interaction.options.getChannel("channel") as VoiceBasedChannel | null;
    const memberChannel = member.voice.channel;

    // Use specified channel, or member's channel, or error
    const channel = specifiedChannel ?? memberChannel;

    if (!channel) {
      return interaction.reply({
        ...errorMessage({ description: "Spécifie un salon vocal ou rejoins-en un." }),
        ephemeral: true,
      });
    }

    const query = interaction.options.getString("query", true);
    await interaction.deferReply();

    const player = useMainPlayer();

    try {
      const result = await player.play(channel, query, {
        nodeOptions: {
          metadata: {
            channel: interaction.channel,
            requestedBy: interaction.user,
          },
          leaveOnEmpty: false,
          leaveOnEnd: false,
          leaveOnStop: false,
        },
      });

      const track = result.track;

      await interaction.editReply(
        createMessage({
          title: "Ajouté à la queue",
          description: `**[${track.title}](${track.url})**\nDurée: ${track.duration}`,
          color: "Success",
          footer: `Demandé par ${interaction.user.tag}`,
        })
      );
    } catch (error) {
      logger.error(`/play failed in ${interaction.guild?.name}:`, error);
      await interaction.editReply(
        errorMessage({ description: "Impossible de jouer cette musique." })
      );
    }
  },
} satisfies Command;
