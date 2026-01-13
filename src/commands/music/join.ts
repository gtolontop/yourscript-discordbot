import { SlashCommandBuilder, GuildMember, ChannelType, type VoiceBasedChannel } from "discord.js";
import { joinVoiceChannel } from "@discordjs/voice";
import type { Command } from "../../types/index.js";
import { errorMessage, successMessage } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("join")
    .setDescription("Rejoint un salon vocal")
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Salon vocal (optionnel si tu es déjà dedans)")
        .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
    )
    .addBooleanOption((option) =>
      option
        .setName("247")
        .setDescription("Activer le mode 24/7 (reste connecté en permanence)")
    ),

  async execute(interaction, client) {
    const member = interaction.member as GuildMember;
    const specifiedChannel = interaction.options.getChannel("channel") as VoiceBasedChannel | null;
    const memberChannel = member.voice.channel;
    const enable247 = interaction.options.getBoolean("247") ?? false;

    // Use specified channel, or member's channel, or error
    const channel = specifiedChannel ?? memberChannel;

    if (!channel) {
      return interaction.reply({
        ...errorMessage({ description: "Spécifie un salon vocal ou rejoins-en un." }),
        ephemeral: true,
      });
    }

    const guildId = interaction.guildId!;

    joinVoiceChannel({
      channelId: channel.id,
      guildId: guildId,
      adapterCreator: interaction.guild!.voiceAdapterCreator,
      selfDeaf: true,
    });

    // Save voice session to DB
    await client.db.guild.upsert({
      where: { id: guildId },
      create: { id: guildId },
      update: {},
    });

    await client.db.voiceSession.upsert({
      where: { id: guildId },
      create: {
        id: guildId,
        channelId: channel.id,
        is247: enable247,
      },
      update: {
        channelId: channel.id,
        is247: enable247,
      },
    });

    const message = enable247
      ? `Connecté à **${channel.name}** en mode 24/7`
      : `Connecté à **${channel.name}**`;

    await interaction.reply(successMessage({ description: message }));
  },
} satisfies Command;
