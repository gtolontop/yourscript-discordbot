import type { ModalComponent } from "../../types/index.js";
import { TicketService } from "../../services/TicketService.js";
import { errorMessage, successMessage } from "../../utils/index.js";

export default {
  customId: /^ticket_create_modal/,

  async execute(interaction, client) {
    const subject = interaction.fields.getTextInputValue("subject") || undefined;
    
    let username: string | undefined;
    let serverIp: string | undefined;
    let description: string | undefined;

    try { username = interaction.fields.getTextInputValue("username") || undefined; } catch {}
    try { serverIp = interaction.fields.getTextInputValue("server_ip") || undefined; } catch {}
    try { description = interaction.fields.getTextInputValue("description") || undefined; } catch {}

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
          description: `You already have an open ticket: <#${existingTicket.channelId}>`,
        })
      );
    }

    const channel = await ticketService.createTicket(
      interaction.guild!,
      interaction.user,
      subject,
      category,
      {
        ...(username ? { username } : {}),
        ...(serverIp ? { serverIp } : {}),
        ...(description ? { description } : {}),
      }
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
