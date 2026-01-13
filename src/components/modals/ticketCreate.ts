import type { ModalComponent } from "../../types/index.js";
import { TicketService } from "../../services/TicketService.js";
import { errorMessage, successMessage } from "../../utils/index.js";

export default {
  customId: /^ticket_create_modal/,

  async execute(interaction, client) {
    const subject = interaction.fields.getTextInputValue("subject") || undefined;
    const ticketService = new TicketService(client);

    // Extract category from customId if present (ticket_create_modal_Support)
    const parts = interaction.customId.split("_");
    const category = parts.length > 3 ? parts.slice(3).join("_") : undefined;

    await interaction.deferReply({ ephemeral: true });

    // Check if user already has an open ticket
    const existingTicket = await client.db.ticket.findFirst({
      where: {
        userId: interaction.user.id,
        guildId: interaction.guildId!,
        status: "open",
      },
    });

    if (existingTicket) {
      return interaction.editReply(
        errorMessage({
          description: `Tu as déjà un ticket ouvert: <#${existingTicket.channelId}>`,
        })
      );
    }

    const channel = await ticketService.createTicket(
      interaction.guild!,
      interaction.user,
      subject,
      category
    );

    if (!channel) {
      return interaction.editReply(
        errorMessage({
          description: "Impossible de créer le ticket. Le système n'est peut-être pas configuré.",
        })
      );
    }

    await interaction.editReply(
      successMessage({
        description: `Ton ticket a été créé: ${channel.toString()}`,
      })
    );
  },
} satisfies ModalComponent;
