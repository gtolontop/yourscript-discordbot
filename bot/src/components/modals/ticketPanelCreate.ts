import type { ModalSubmitInteraction, TextChannel } from "discord.js";
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import type { ModalComponent } from "../../types/index.js";
import type { Bot } from "../../client/Bot.js";
import { successMessage, errorMessage, Colors } from "../../utils/index.js";

const ticketPanelCreate: ModalComponent = {
  customId: "ticket_panel_create",

  async execute(
    interaction: ModalSubmitInteraction,
    client: Bot
  ): Promise<unknown> {
    const title = interaction.fields.getTextInputValue("panel_title");
    const description = interaction.fields.getTextInputValue(
      "panel_description"
    );
    const buttonText =
      interaction.fields.getTextInputValue("panel_button_text") ||
      "Create Ticket";
    const buttonEmoji =
      interaction.fields.getTextInputValue("panel_button_emoji") || "🎫";

    const channel = interaction.channel as TextChannel | null;

    if (!channel || !channel.isTextBased()) {
      return interaction.reply({
        ...errorMessage({ description: "Invalid channel." }),
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(Colors.primary)
      .setTimestamp();

    const button = new ButtonBuilder()
      .setCustomId("ticket_create")
      .setLabel(buttonText)
      .setEmoji(buttonEmoji)
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    try {
      await channel.send({
        embeds: [embed],
        components: [row],
      });

      return interaction.reply({
        ...successMessage({
          description: "Ticket panel created successfully.",
        }),
        ephemeral: true,
      });
    } catch (error) {
      console.error("Failed to create ticket panel:", error);
      return interaction.reply({
        ...errorMessage({
          description:
            "Failed to create the ticket panel. Check bot permissions.",
        }),
        ephemeral: true,
      });
    }
  },
};

export default ticketPanelCreate;
