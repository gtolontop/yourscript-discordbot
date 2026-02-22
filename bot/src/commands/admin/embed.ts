import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../types/index.js";
import type { Bot } from "../../client/Bot.js";
import { errorMessage } from "../../utils/index.js";

const data = new SlashCommandBuilder()
  .setName("embed")
  .setDescription("Send a custom embed message via a modal form")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addChannelOption((opt) =>
    opt
      .setName("channel")
      .setDescription("Channel to send the embed to (default: current)")
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setRequired(false)
  )
  .addBooleanOption((opt) =>
    opt
      .setName("mention-everyone")
      .setDescription("Mention @everyone with the embed?")
      .setRequired(false)
  );

async function execute(
  interaction: ChatInputCommandInteraction,
  client: Bot
): Promise<unknown> {
  const channelOption = interaction.options.getChannel("channel");
  const channel = channelOption
    ? client.channels.cache.get(channelOption.id)
    : interaction.channel;
  const mentionEveryone =
    interaction.options.getBoolean("mention-everyone") ?? false;

  if (!channel || !channel.isTextBased()) {
    return interaction.reply({
      ...errorMessage({ description: "Invalid channel." }),
      ephemeral: true,
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(`embed_create_${channel.id}_${mentionEveryone}`)
    .setTitle("Create Embed");

  const titleInput = new TextInputBuilder()
    .setCustomId("embed_title")
    .setLabel("Title")
    .setPlaceholder("Your embed title")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(256);

  const descInput = new TextInputBuilder()
    .setCustomId("embed_description")
    .setLabel("Description")
    .setPlaceholder("Write your embed content here...")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(4000);

  const colorInput = new TextInputBuilder()
    .setCustomId("embed_color")
    .setLabel("Color (hex, e.g. #5865F2)")
    .setPlaceholder("#5865F2")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(7);

  const imageInput = new TextInputBuilder()
    .setCustomId("embed_image")
    .setLabel("Image URL (optional)")
    .setPlaceholder("https://example.com/image.png")
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  const footerInput = new TextInputBuilder()
    .setCustomId("embed_footer")
    .setLabel("Footer (optional)")
    .setPlaceholder("Footer text")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(100);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(descInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(colorInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(imageInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(footerInput)
  );

  return interaction.showModal(modal);
}

export default { data, execute } satisfies Command;
