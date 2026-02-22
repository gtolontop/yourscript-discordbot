import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { ButtonComponent } from "../../types/index.js";
import { Bot } from "../../client/Bot.js";
import { logger } from "../../utils/logger.js";

export default {
  customId: /^review_refuse_/,

  async execute(interaction, client: Bot) {
    // Extract ticket ID from custom ID (review_refuse_123)
    const ticketId = parseInt(interaction.customId.split("_")[2]!);

    if (isNaN(ticketId)) {
      await interaction.reply({
        content: "Invalid ticket ID.",
        ephemeral: true,
      });
      return;
    }

    try {
      // Delete the review request message (update it to show refusal)
      await interaction.update({
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`review_done_${ticketId}`)
              .setLabel(`Refused by ${interaction.user.username}`)
              .setStyle(ButtonStyle.Danger)
              .setDisabled(true),
          ),
        ],
      });
    } catch (error) {
      logger.error("Failed to refuse review:", error);
      await interaction.reply({
        content: "An error occurred while refusing the review.",
        ephemeral: true,
      });
    }
  },
} satisfies ButtonComponent;
