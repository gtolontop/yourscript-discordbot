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

    // Store Page Previewer
    const tebexURL = message.content.match(/https?:\/\/([a-zA-Z0-9-]+\.)?(tebex\.io|buycraft\.net)\/package\/([0-9]+)/i);
    if (tebexURL) {
      try {
        const response = await fetch(tebexURL[0]);
        if (response.ok) {
           const html = await response.text();
           
           const getMeta = (property: string) => {
              const match = html.match(new RegExp(`<meta\\s+(?:property|name)=["']${property}["']\\s+content=["'](.*?)["']`, 'i')) || 
                            html.match(new RegExp(`<meta\\s+content=["'](.*?)["']\\s+(?:property|name)=["']${property}["']`, 'i'));
              return match ? match[1] : null;
           };

           const title = getMeta("og:title") ?? getMeta("twitter:title");
           let description = getMeta("og:description") ?? getMeta("twitter:description");
           const image = getMeta("og:image") ?? getMeta("twitter:image");

           if (title) {
             const cleanDesc = description ? (description.length > 200 ? description.substring(0, 197) + "..." : description) : "Check the store for more details about this package.";
             
             const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import("discord.js");
             const embed = new EmbedBuilder()
               .setTitle(`🛒 ${title}`)
               .setDescription(cleanDesc)
               .setURL(tebexURL[0])
               .setColor(0x00A8FF)
               .setFooter({ text: "Store Preview", iconURL: "https://tebex.io/favicon.ico" });

             if (image) embed.setImage(image);

             const row = new ActionRowBuilder<any>().addComponents(
                new ButtonBuilder()
                   .setLabel("View Package")
                   .setStyle(ButtonStyle.Link)
                   .setURL(tebexURL[0])
             );

             await message.reply({ embeds: [embed], components: [row] }).catch(() => {});
           }
        }
      } catch (err) {
        // Silently fails for invalid loads
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

        let finalContent = message.content;
        let isBotAction = message.author.bot;
        let finalUserId = message.author.id;
        let finalUsername = message.author.username;

        // Intercept Questionnaire Submissions from Bot and trick the AI into thinking the User sent them
        if (isBotAction && message.embeds.length > 0 && finalContent.includes("Here is the information I have provided:")) {
          const embed = message.embeds[0];
          const answers = embed.fields.map(f => `${f.name}:\n${f.value}`).join("\n\n");
          finalContent = `[SYSTEM NOTE: The user has filled out the questionnaire form. Here are their answers:]\n\n${answers}`;
          
          isBotAction = false; // Bypass the bot check in ticketHandler
          finalUserId = ticket.userId; // Attribute it directly to the user
          finalUsername = embed.author?.name || "User";
        }

        client.aiNamespace.emit("ticket:message", {
          ticketId: ticket.id,
          channelId: message.channelId,
          guildId: message.guild.id,
          content: finalContent,
          userId: finalUserId,
          username: finalUsername,
          isStaff,
          isBot: isBotAction,
          attachments: message.attachments.map(a => ({ url: a.url, contentType: a.contentType })),
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
