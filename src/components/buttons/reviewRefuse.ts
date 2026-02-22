import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { ButtonComponent } from "../../types/index.js";
import { errorMessage } from "../../utils/index.js";

export default {
  customId: "review_refuse",

  async execute(interaction, client) {
    // Extract ticket ID from custom ID (review_refuse_123)
    const ticketId = parseInt(interaction.customId.split("_")[2]!);

    if (isNaN(ticketId)) {
      return interaction.reply({
        ...errorMessage({ description: "Invalid ticket ID." }),
        ephemeral: true,
      });
    }

    // Update ticket status
    await client.db.ticket.update({
      where: { id: ticketId },
      data: { status: "review_refused" },
    });

    // Update the message
    await interaction.update({
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`review_done_${ticketId}`)
            .setLabel(`Declined by ${interaction.user.username}`)
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true)
        ),
      ],
    });
  },
} satisfies ButtonComponent;
