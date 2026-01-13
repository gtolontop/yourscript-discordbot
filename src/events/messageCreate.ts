import { Events, type Message } from "discord.js";
import type { Event } from "../types/index.js";
import { TicketService } from "../services/TicketService.js";

export default {
  name: Events.MessageCreate,
  async execute(client, message: Message) {
    // Ignore DMs and bots
    if (!message.guild || message.author.bot) return;

    // Update ticket last activity if message is in a ticket channel
    const ticket = await client.db.ticket.findUnique({
      where: { channelId: message.channelId },
    });

    if (ticket && ticket.status === "open") {
      const ticketService = new TicketService(client);
      await ticketService.updateLastActivity(message.channelId);
    }
  },
} satisfies Event<"messageCreate">;
