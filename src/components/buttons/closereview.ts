import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";
import type { ButtonComponent } from "../../types/index.js";
import { errorMessage } from "../../utils/index.js";

export default {
  customId: "closereview",

  async execute(interaction, client) {
    const parts = interaction.customId.split("_");
    const ticketId = parseInt(parts[1]!);

    if (isNaN(ticketId)) {
      return interaction.reply({
        ...errorMessage({ description: "Invalid ticket." }),
        ephemeral: true,
      });
    }

    const ticket = await client.db.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket || ticket.status !== "open") {
      return interaction.reply({
        ...errorMessage({ description: "This ticket is already closed." }),
        ephemeral: true,
      });
    }

    // Show review modal - on submit it will close the ticket too
    const modal = new ModalBuilder()
      .setCustomId(`closereview_submit_${ticketId}_${ticket.guildId}`)
      .setTitle("Leave a review & close");

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
