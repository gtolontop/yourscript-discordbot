import { Events, type Message } from "discord.js";
import type { Event } from "../types/index.js";
import { TicketService } from "../services/TicketService.js";
import { XpService } from "../services/XpService.js";

// Image scammer tracker
const imageScamTracker = new Map<string, { channelIds: Set<string>; count: number; resetAt: number }>();

export default {
  name: Events.MessageCreate,
  async execute(client, message: Message) {
    // Ignore DMs and bots
    if (!message.guild || message.author.bot) return;

    // Fetch config once
    const config = await client.db.guild.findUnique({ where: { id: message.guild.id } }) as any;

    // Anti-Scam Check
    if (config?.antiScamEnabled && message.content) {
      // Basic scam heuristics
      const scamRegex = /(discoord|dlscord|discord-nitro|free\s*nitro|steamcommunity-|steam-promo|discord\.gift)/i;
      if (scamRegex.test(message.content)) {
        const isStaff = config.ticketSupportRole
          ? message.member?.roles.cache.has(config.ticketSupportRole)
          : message.member?.permissions.has("ManageMessages");

        if (!isStaff) {
          try {
            await message.delete();
            await message.author.send("⚠️ Your message was deleted by the Anti-Scam filter.").catch(() => {});
            return; // Stop processing
          } catch {}
        }
      }
    }

    // Update ticket last activity if message is in a ticket channel
    const ticket = await client.db.ticket.findUnique({
      where: { channelId: message.channelId },
    });

    if (ticket && ticket.status === "open") {
      const ticketService = new TicketService(client);
      await ticketService.updateLastActivity(message.channelId);

      // Emit ticket:message to AI namespace
      if (client.aiNamespace && message.content) {
        const guildConfig = await client.db.guild.findUnique({ where: { id: message.guild.id } });
        const isStaff = guildConfig?.ticketSupportRole
          ? message.member?.roles.cache.has(guildConfig.ticketSupportRole) ?? false
          : message.member?.permissions.has("ManageMessages") ?? false;

        client.aiNamespace.emit("ticket:message", {
          ticketId: ticket.id,
          channelId: message.channelId,
          guildId: message.guild.id,
          content: message.content,
          userId: message.author.id,
          username: message.author.username,
          isStaff,
          isBot: message.author.bot,
        });
      }
    }

    // Process XP
    const xpService = new XpService(client as any);
    await xpService.handleMessage(message);

    // Detect staff replies in DM log threads → relay to selfbot
    if (client.aiNamespace && message.channel.isThread() && message.content) {
      const guildConfig = await client.db.guild.findUnique({ where: { id: message.guild.id } });
      if (guildConfig?.aiDmLogChannel && message.channel.parentId === guildConfig.aiDmLogChannel) {
        // This is a message in a DM log thread - check if it's a staff member (not bot)
        const isStaff = guildConfig.ticketSupportRole
          ? message.member?.roles.cache.has(guildConfig.ticketSupportRole) ?? false
          : message.member?.permissions.has("ManageMessages") ?? false;

        if (isStaff) {
          client.aiNamespace.emit("dm:threadReply" as any, {
            threadId: message.channel.id,
            content: message.content,
            userId: message.author.id,
            username: message.author.username,
          });
        }
      }
    }
  },
} satisfies Event<"messageCreate">;
