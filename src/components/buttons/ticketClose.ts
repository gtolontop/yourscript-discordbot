import { TextChannel } from "discord.js";
import type { ButtonComponent } from "../../types/index.js";
import { TicketService } from "../../services/TicketService.js";
import { warningMessage } from "../../utils/index.js";

export default {
  customId: "ticket_close",

  async execute(interaction, client) {
    const channel = interaction.channel as TextChannel;
    const ticketService = new TicketService(client);

    await interaction.reply(
      warningMessage({ description: "Fermeture du ticket en cours..." })
    );

    await ticketService.closeTicket(channel, interaction.user);
  },
} satisfies ButtonComponent;
