import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ChannelType,
} from "discord.js";
import type { Command } from "../../types/index.js";
import { errorMessage } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("annonce")
    .setDescription("Create an announcement with a modal")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("Channel to send the announcement (default: current channel)")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false)
    )
    .addBooleanOption((opt) =>
      opt
        .setName("mention")
        .setDescription("Mention @everyone?")
        .setRequired(false)
    ),

  async execute(interaction, client) {
    const channelOption = interaction.options.getChannel("channel");
    const channel = channelOption
      ? client.channels.cache.get(channelOption.id)
      : interaction.channel;
    const mention = interaction.options.getBoolean("mention") ?? false;

    if (!channel || !channel.isTextBased()) {
      return interaction.reply({
        ...errorMessage({ description: "Invalid channel." }),
        ephemeral: true,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`annonce_create_${channel.id}_${mention}`)
      .setTitle("Create an announcement");

    const titleInput = new TextInputBuilder()
      .setCustomId("annonce_title")
      .setLabel("Announcement title")
      .setPlaceholder("New update!")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const descInput = new TextInputBuilder()
      .setCustomId("annonce_description")
      .setLabel("Announcement content")
      .setPlaceholder("Describe your announcement here...")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(2000);

    const imageInput = new TextInputBuilder()
      .setCustomId("annonce_image")
      .setLabel("Image URL (optional)")
      .setPlaceholder("https://exemple.com/image.png")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const footerInput = new TextInputBuilder()
      .setCustomId("annonce_footer")
      .setLabel("Footer (optional)")
      .setPlaceholder("YourScript Team")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(100);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(descInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(imageInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(footerInput)
    );

    await interaction.showModal(modal);
  },
} satisfies Command;
