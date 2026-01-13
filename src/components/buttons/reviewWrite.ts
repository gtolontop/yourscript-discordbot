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
    const ticketId = parseInt(parts[2]);
    const guildId = parts[3];

    if (isNaN(ticketId) || !guildId) {
      return interaction.reply({
        ...errorMessage({ description: "Données invalides." }),
        ephemeral: true,
      });
    }

    const ticket = await client.db.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      return interaction.reply({
        ...errorMessage({ description: "Ticket introuvable." }),
        ephemeral: true,
      });
    }

    // Check if already reviewed
    if (ticket.review) {
      return interaction.reply({
        ...errorMessage({ description: "Tu as déjà donné ton avis pour ce ticket." }),
        ephemeral: true,
      });
    }

    // Show modal for review
    const modal = new ModalBuilder()
      .setCustomId(`review_submit_${ticketId}_${guildId}`)
      .setTitle("Donne ton avis");

    const ratingInput = new TextInputBuilder()
      .setCustomId("rating")
      .setLabel("Note (1 à 5 étoiles)")
      .setPlaceholder("5")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(1);

    const reviewInput = new TextInputBuilder()
      .setCustomId("review")
      .setLabel("Ton avis")
      .setPlaceholder("Comment s'est passée ton expérience avec le support ?")
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
