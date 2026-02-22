import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";
import type { ButtonComponent } from "../../types/index.js";
import { errorMessage } from "../../utils/index.js";

export default {
  customId: "review_write",

  async execute(interaction, client) {
    // Extract ticket ID and guild ID from customId (review_write_123_456)
    const parts = interaction.customId.split("_");
    const ticketId = parseInt(parts[2]!);
    const guildId = parts[3];

    if (isNaN(ticketId) || !guildId) {
      return interaction.reply({
        ...errorMessage({ description: "Invalid data." }),
        ephemeral: true,
      });
    }

    const ticket = await client.db.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      return interaction.reply({
        ...errorMessage({ description: "Ticket not found." }),
        ephemeral: true,
      });
    }

    // Check if already reviewed
    if (ticket.review) {
      return interaction.reply({
        ...errorMessage({ description: "You have already given your feedback for this ticket." }),
        ephemeral: true,
      });
    }

    // Show modal for review
    const modal = new ModalBuilder()
      .setCustomId(`review_submit_${ticketId}_${guildId}`)
      .setTitle("Give your feedback");

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
      .setPlaceholder("How was your experience with the support?")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(500);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(ratingInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(reviewInput)
    );

    await interaction.showModal(modal);
  },
} satisfies ButtonComponent;
