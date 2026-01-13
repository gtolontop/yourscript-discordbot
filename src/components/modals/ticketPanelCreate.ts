import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import type { ModalComponent } from "../../types/index.js";
import { Colors } from "../../utils/index.js";

export default {
  customId: "ticket_panel_create",

  async execute(interaction, client) {
    const title = interaction.fields.getTextInputValue("panel_title");
    const description = interaction.fields.getTextInputValue("panel_description");
    const buttonText = interaction.fields.getTextInputValue("panel_button_text");
    const buttonEmoji = interaction.fields.getTextInputValue("panel_button_emoji") || "🎫";

    const embed = new EmbedBuilder()
      .setTitle(`🎫 ${title}`)
      .setDescription(description)
      .setColor(Colors.Primary);

    const button = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_create")
        .setLabel(buttonText)
        .setStyle(ButtonStyle.Primary)
        .setEmoji(buttonEmoji)
    );

    // Send panel to channel (classic embed, not Components V2)
    await interaction.channel?.send({
      embeds: [embed],
      components: [button],
    });

    await interaction.reply({
      content: "✅ Panel de tickets envoyé !",
      ephemeral: true,
    });
  },
} satisfies ModalComponent;
