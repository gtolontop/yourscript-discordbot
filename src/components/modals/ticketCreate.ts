import type { ModalComponent } from "../../types/index.js";
import { TicketService } from "../../services/TicketService.js";
import { errorMessage, successMessage, logger } from "../../utils/index.js";

export default {
  customId: /^ticket_create_modal/,

  async execute(interaction, client) {
    const ticketService = new TicketService(client);

    // Extract category from customId: ticket_create_modal_Support → "Support"
    const parts = interaction.customId.split("_");
    const categoryName = parts.length > 3 ? parts.slice(3).join("_") : undefined;

    await interaction.deferReply({ ephemeral: true });

    const extraData: Record<string, string> = {};
    let subject: string | undefined;

    // Collect all fields dynamically — modals are per-category now
    try {
      interaction.fields.fields.forEach((fieldObj) => {
        const field = fieldObj as any;
        if (field.customId === "subject") {
          subject = field.value?.trim() || undefined;
        } else if (field.value?.trim()) {
          extraData[field.customId] = field.value.trim();
        }
      });
    } catch (e) {
      logger.error(`[MODAL] Error parsing fields:`, e);
    }

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
          description: `You already have an open ticket: <#${existingTicket.channelId}>`,
        })
      );
    }

    const channel = await ticketService.createTicket(
      interaction.guild!,
      interaction.user,
      subject,
      categoryName,
      extraData
    );

    if (!channel) {
      return interaction.editReply(
        errorMessage({
          description: "Unable to create the ticket. The system may not be configured.",
        })
      );
    }

    await interaction.editReply(
      successMessage({
        description: `Your ticket has been created: ${channel.toString()}`,
      })
    );
  },
} satisfies ModalComponent;
