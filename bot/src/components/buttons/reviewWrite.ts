import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";
import type { ButtonComponent } from "../../types/index.js";
import { Bot } from "../../client/Bot.js";
import { logger } from "../../utils/logger.js";

export default {
  customId: /^review_write_/,

  async execute(interaction, client: Bot) {
    // Extract ticket ID and guild ID from customId (review_write_123_456)
    const parts = interaction.customId.split("_");
    const ticketId = parseInt(parts[2]!);
    const guildId = parts[3];

    if (isNaN(ticketId) || !guildId) {
      await interaction.reply({
        content: "Invalid data.",
        ephemeral: true,
      });
      return;
    }

    try {
      // Show modal for review text + rating
      const modal = new ModalBuilder()
        .setCustomId(`review_submit_${ticketId}_${guildId}`)
        .setTitle("Leave a Review");

      const ratingInput = new TextInputBuilder()
        .setCustomId("rating")
        .setLabel("Rating (1 to 5 stars)")
        .setPlaceholder("5")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(1);

      const reviewInput = new TextInputBuilder()
        .setCustomId("review")
        .setLabel("Your review")
        .setPlaceholder("How was your experience with our support?")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMinLength(10)
        .setMaxLength(500);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(ratingInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(reviewInput),
      );

      await interaction.showModal(modal);
    } catch (error) {
      logger.error("Failed to show review modal:", error);
      await interaction.reply({
        content: "An error occurred while opening the review form.",
        ephemeral: true,
      });
    }
  },
} satisfies ButtonComponent;
