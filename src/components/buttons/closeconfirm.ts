import { TextChannel } from "discord.js";
import type { ButtonComponent } from "../../types/index.js";
import { TicketService } from "../../services/TicketService.js";
import { warningMessage, errorMessage } from "../../utils/index.js";

export default {
  customId: "closeconfirm",

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
    if (!ticket || (ticket.status !== "open" && ticket.status !== "review_submitted")) {
      return interaction.reply({
        ...errorMessage({ description: "This ticket is already closed." }),
        ephemeral: true,
      });
    }

    // Disable buttons on the message
    await interaction.update({
      components: [],
    });

    const channel = interaction.channel as TextChannel;
    const ticketService = new TicketService(client);

    await channel.send(warningMessage({ description: "Closing ticket..." }));
    await ticketService.closeTicket(channel, interaction.user);
  },
} satisfies ButtonComponent;
