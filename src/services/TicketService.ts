import {
  Guild,
  TextChannel,
  ChannelType,
  OverwriteType,
  User,
  Message,
  Collection,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  AttachmentBuilder,
} from "discord.js";
import type { Bot } from "../client/Bot.js";
import { createMessage, successMessage, errorMessage, Colors } from "../utils/index.js";

export class TicketService {
  constructor(private client: Bot) {}

  /**
   * Get guild ticket config
   */
  async getConfig(guildId: string) {
    return this.client.db.guild.findUnique({
      where: { id: guildId },
    });
  }

  /**
   * Create a new ticket
   */
  async createTicket(guild: Guild, user: User, subject?: string, category?: string): Promise<TextChannel | null> {
    const config = await this.getConfig(guild.id);
    if (!config?.ticketCategoryId) return null;

    // Increment ticket counter
    const updated = await this.client.db.guild.update({
      where: { id: guild.id },
      data: { ticketCounter: { increment: 1 } },
    });

    const ticketNumber = updated.ticketCounter;

    // Create channel
    const permissionOverwrites: any[] = [
      {
        id: guild.roles.everyone.id,
        type: OverwriteType.Role,
        deny: ["ViewChannel"],
      },
      {
        id: user.id,
        type: OverwriteType.Member,
        allow: ["ViewChannel", "SendMessages", "AttachFiles", "ReadMessageHistory"],
      },
      {
        id: this.client.user!.id,
        type: OverwriteType.Member,
        allow: ["ViewChannel", "SendMessages", "ManageChannels", "ManageMessages"],
      },
    ];

    // Add support role if configured
    if (config.ticketSupportRole) {
      permissionOverwrites.push({
        id: config.ticketSupportRole,
        type: OverwriteType.Role,
        allow: ["ViewChannel", "SendMessages", "AttachFiles", "ReadMessageHistory"],
      });
    }

    // Create channel with category prefix if exists
    const channelName = category
      ? `${category.toLowerCase()}-${ticketNumber.toString().padStart(4, "0")}`
      : `ticket-${ticketNumber.toString().padStart(4, "0")}`;

    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: config.ticketCategoryId,
      topic: `Ticket de ${user.tag} | ${category ?? "Général"} | ${subject ?? "Pas de sujet"}`,
      permissionOverwrites,
    });

    // Save ticket to DB
    await this.client.db.ticket.create({
      data: {
        number: ticketNumber,
        channelId: channel.id,
        userId: user.id,
        guildId: guild.id,
        category,
        subject,
      },
    });

    // Build welcome embed
    const welcomeEmbed = new EmbedBuilder()
      .setTitle(`🎫 Ticket #${ticketNumber.toString().padStart(4, "0")}`)
      .setDescription([
        `Bienvenue ${user.toString()} !`,
        "",
        category ? `**Catégorie:** ${category}` : null,
        subject ? `**Sujet:** ${subject}` : null,
        `**Priorité:** 🟡 Normale`,
        "",
        "Un membre du staff va te répondre bientôt.",
      ].filter(Boolean).join("\n"))
      .setColor(Colors.Primary)
      .setFooter({ text: "Staff: Utilise les boutons ci-dessous ou /ticket" })
      .setTimestamp();

    // Build action buttons
    const ticketButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_claim")
        .setLabel("Prendre en charge")
        .setStyle(ButtonStyle.Success)
        .setEmoji("✋"),
      new ButtonBuilder()
        .setCustomId("ticket_close")
        .setLabel("Fermer")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("🔒")
    );

    // Send welcome message with ping
    const pingContent = config.ticketSupportRole
      ? `<@${user.id}> <@&${config.ticketSupportRole}>`
      : `<@${user.id}>`;

    await channel.send({
      content: pingContent,
      embeds: [welcomeEmbed],
      components: [ticketButtons],
    });

    return channel;
  }

  /**
   * Close a ticket
   */
  async closeTicket(channel: TextChannel, closedBy: User): Promise<boolean> {
    const ticket = await this.client.db.ticket.findUnique({
      where: { channelId: channel.id },
    });

    if (!ticket || ticket.status !== "open") return false;

    // Update ticket status
    await this.client.db.ticket.update({
      where: { id: ticket.id },
      data: {
        status: "closed",
        closedBy: closedBy.id,
        closedAt: new Date(),
      },
    });

    // Get config and user info
    const config = await this.getConfig(ticket.guildId);
    const guild = channel.guild;
    const ticketUser = await this.client.users.fetch(ticket.userId).catch(() => null);

    // Generate HTML transcript and save to DB
    const { html: transcriptHtml, messageCount } = await this.generateTranscript(channel, ticket.number, ticketUser);

    // Save transcript to database
    const savedTranscript = await this.client.db.transcript.create({
      data: {
        ticketId: ticket.id,
        ticketNumber: ticket.number,
        guildId: ticket.guildId,
        guildName: guild.name,
        userId: ticket.userId,
        userName: ticketUser?.tag ?? "Inconnu",
        closedBy: closedBy.id,
        closedByName: closedBy.tag,
        subject: ticket.subject,
        category: ticket.category,
        messageCount,
        html: transcriptHtml,
      },
    });

    // Get web URL from env or default
    const webUrl = process.env.WEB_URL ?? `http://localhost:${process.env.WEB_PORT ?? 3000}`;
    const transcriptUrl = `${webUrl}/transcript/${savedTranscript.id}`;

    // Also create file attachment as backup
    const transcriptFile = new AttachmentBuilder(Buffer.from(transcriptHtml, "utf-8"), {
      name: `transcript-ticket-${ticket.number.toString().padStart(4, "0")}.html`,
    });

    // Send transcript with review button
    if (config?.ticketTranscriptChannel) {
      const transcriptChannel = guild.channels.cache.get(config.ticketTranscriptChannel) as TextChannel;
      if (transcriptChannel) {
        const transcriptEmbed = new EmbedBuilder()
          .setTitle(`📜 Transcript - Ticket #${ticket.number.toString().padStart(4, "0")}`)
          .setDescription([
            `**Créé par:** ${ticketUser?.tag ?? "Inconnu"} (<@${ticket.userId}>)`,
            `**Fermé par:** ${closedBy.tag}`,
            `**Sujet:** ${ticket.subject ?? "Aucun"}`,
            `**Catégorie:** ${ticket.category ?? "Aucune"}`,
            `**Messages:** ${messageCount}`,
            `**Durée:** ${this.formatDuration(ticket.createdAt, new Date())}`,
            "",
            `🔗 **[Voir le transcript en ligne](${transcriptUrl})**`,
          ].join("\n"))
          .setColor(Colors.Primary)
          .setTimestamp();

        const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel("Voir en ligne")
            .setStyle(ButtonStyle.Link)
            .setURL(transcriptUrl)
            .setEmoji("🌐"),
          new ButtonBuilder()
            .setCustomId(`review_request_${ticket.id}`)
            .setLabel("Demander un avis")
            .setStyle(ButtonStyle.Primary)
            .setEmoji("💬")
        );

        await transcriptChannel.send({
          embeds: [transcriptEmbed],
          files: [transcriptFile],
          components: [buttons],
        });
      }
    }

    // Delete channel after a delay
    await channel.send(
      successMessage({
        description: "Ticket fermé. Ce channel sera supprimé dans 5 secondes...",
      })
    );

    setTimeout(async () => {
      await channel.delete().catch(() => {});
    }, 5000);

    return true;
  }

  /**
   * Generate HTML transcript from channel messages
   */
  async generateTranscript(channel: TextChannel, ticketNumber: number, ticketUser: User | null): Promise<{ html: string; messageCount: number }> {
    const messages: Message[] = [];
    let lastId: string | undefined;

    // Fetch all messages (up to 500)
    while (messages.length < 500) {
      const fetched = await channel.messages.fetch({
        limit: 100,
        before: lastId,
      });

      if (fetched.size === 0) break;

      messages.push(...fetched.values());
      lastId = fetched.last()?.id;
    }

    // Reverse to get chronological order
    messages.reverse();

    // Build cache of users and roles for mention resolution
    const userCache = new Map<string, string>();
    const roleCache = new Map<string, { name: string; color: string }>();
    const channelCache = new Map<string, string>();

    // Cache roles from guild
    channel.guild.roles.cache.forEach((role) => {
      const color = role.hexColor === "#000000" ? "#99aab5" : role.hexColor;
      roleCache.set(role.id, { name: role.name, color });
    });

    // Cache channels from guild
    channel.guild.channels.cache.forEach((ch) => {
      channelCache.set(ch.id, ch.name);
    });

    // Cache users from messages
    for (const msg of messages) {
      if (msg.author) {
        userCache.set(msg.author.id, msg.author.displayName || msg.author.username);
      }
      // Also check mentions in the message
      msg.mentions.users.forEach((user) => {
        userCache.set(user.id, user.displayName || user.username);
      });
    }

    // Generate HTML
    const messagesHtml = messages.map((msg) => {
      const time = msg.createdAt.toLocaleString("fr-FR");
      const author = msg.author?.tag ?? "Inconnu";
      const avatarUrl = msg.author?.displayAvatarURL({ size: 64 }) ?? "";
      const isBot = msg.author?.bot ?? false;

      let content = this.escapeHtml(msg.content);

      // Convert user mentions <@ID> or <@!ID> to styled spans
      content = content.replace(/&lt;@!?(\d+)&gt;/g, (_, id) => {
        const name = userCache.get(id) ?? "utilisateur";
        return `<span class="mention user">@${name}</span>`;
      });

      // Convert role mentions <@&ID> to styled spans
      content = content.replace(/&lt;@&amp;(\d+)&gt;/g, (_, id) => {
        const role = roleCache.get(id);
        if (role) {
          return `<span class="mention role" style="color: ${role.color}; background: ${role.color}22;">@${role.name}</span>`;
        }
        return `<span class="mention role">@rôle</span>`;
      });

      // Convert channel mentions <#ID> to styled spans
      content = content.replace(/&lt;#(\d+)&gt;/g, (_, id) => {
        const name = channelCache.get(id) ?? "channel";
        return `<span class="mention channel">#${name}</span>`;
      });

      // Convert Discord markdown to HTML
      content = this.convertMarkdown(content);

      // Handle attachments
      const attachments = msg.attachments.map((att) => {
        if (att.contentType?.startsWith("image/")) {
          return `<div class="attachment"><img src="${att.url}" alt="Image" style="max-width: 400px; border-radius: 8px;"></div>`;
        }
        return `<div class="attachment"><a href="${att.url}" target="_blank">📎 ${att.name}</a></div>`;
      }).join("");

      // Handle embeds
      const embedsHtml = msg.embeds.map((embed) => {
        const colorStyle = embed.hexColor ? `border-left-color: ${embed.hexColor};` : "";
        let embedContent = "";

        if (embed.author) {
          embedContent += `<div class="embed-author">${this.escapeHtml(embed.author.name ?? "")}</div>`;
        }
        if (embed.title) {
          embedContent += `<div class="embed-title">${this.escapeHtml(embed.title)}</div>`;
        }
        if (embed.description) {
          let desc = this.escapeHtml(embed.description);
          // Convert mentions in embed descriptions too
          desc = desc.replace(/&lt;@!?(\d+)&gt;/g, (_, id) => {
            const name = userCache.get(id) ?? "utilisateur";
            return `<span class="mention user">@${name}</span>`;
          });
          desc = desc.replace(/&lt;@&amp;(\d+)&gt;/g, (_, id) => {
            const role = roleCache.get(id);
            if (role) {
              return `<span class="mention role" style="color: ${role.color};">@${role.name}</span>`;
            }
            return `<span class="mention role">@rôle</span>`;
          });
          // Apply markdown conversion
          desc = this.convertMarkdown(desc);
          embedContent += `<div class="embed-description">${desc}</div>`;
        }
        if (embed.fields.length > 0) {
          embedContent += `<div class="embed-fields">`;
          for (const field of embed.fields) {
            embedContent += `
              <div class="embed-field${field.inline ? " inline" : ""}">
                <div class="embed-field-name">${this.escapeHtml(field.name)}</div>
                <div class="embed-field-value">${this.convertMarkdown(this.escapeHtml(field.value))}</div>
              </div>
            `;
          }
          embedContent += `</div>`;
        }
        if (embed.image) {
          embedContent += `<div class="embed-image"><img src="${embed.image.url}" alt="Image"></div>`;
        }
        if (embed.thumbnail) {
          embedContent += `<div class="embed-thumbnail"><img src="${embed.thumbnail.url}" alt="Thumbnail"></div>`;
        }
        if (embed.footer) {
          embedContent += `<div class="embed-footer">${this.escapeHtml(embed.footer.text ?? "")}</div>`;
        }

        return `<div class="embed" style="${colorStyle}">${embedContent}</div>`;
      }).join("");

      return `
        <div class="message">
          <img class="avatar" src="${avatarUrl}" alt="${author}">
          <div class="content">
            <div class="header">
              <span class="author${isBot ? " bot" : ""}">${author}</span>
              ${isBot ? '<span class="bot-tag">BOT</span>' : ""}
              <span class="timestamp">${time}</span>
            </div>
            <div class="text">${content || ""}</div>
            ${attachments}
            ${embedsHtml}
          </div>
        </div>
      `;
    }).join("");

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transcript - Ticket #${ticketNumber.toString().padStart(4, "0")}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Whitney', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background: #36393f;
      color: #dcddde;
      line-height: 1.5;
    }
    .header-info {
      background: #2f3136;
      padding: 20px;
      border-bottom: 1px solid #202225;
    }
    .header-info h1 {
      color: #fff;
      font-size: 24px;
      margin-bottom: 10px;
    }
    .header-info p {
      color: #b9bbbe;
      font-size: 14px;
    }
    .messages {
      padding: 20px;
    }
    .message {
      display: flex;
      padding: 8px 0;
      margin: 4px 0;
    }
    .message:hover {
      background: #32353b;
    }
    .avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      margin-right: 16px;
      flex-shrink: 0;
    }
    .content {
      flex: 1;
      min-width: 0;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .author {
      font-weight: 500;
      color: #fff;
    }
    .author.bot {
      color: #5865f2;
    }
    .bot-tag {
      background: #5865f2;
      color: #fff;
      font-size: 10px;
      padding: 1px 4px;
      border-radius: 3px;
      font-weight: 600;
    }
    .timestamp {
      color: #72767d;
      font-size: 12px;
    }
    .text {
      color: #dcddde;
      word-wrap: break-word;
    }
    .text code, .text .inline-code {
      background: #2f3136;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 0.9em;
    }
    .text .code-block {
      background: #2f3136;
      border-radius: 4px;
      padding: 12px;
      margin: 8px 0;
      overflow-x: auto;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 0.875em;
      line-height: 1.4;
    }
    .text .code-block code {
      background: none;
      padding: 0;
    }
    .text .spoiler {
      background: #202225;
      color: #202225;
      border-radius: 3px;
      padding: 0 4px;
      cursor: pointer;
      transition: color 0.1s;
    }
    .text .spoiler:hover {
      color: #dcddde;
    }
    .text .quote {
      border-left: 4px solid #4f545c;
      padding-left: 12px;
      margin: 4px 0;
      color: #b9bbbe;
    }
    .text del {
      color: #72767d;
      text-decoration: line-through;
    }
    .text u {
      text-decoration: underline;
    }
    .text strong {
      color: #fff;
      font-weight: 700;
    }
    .text em {
      font-style: italic;
    }
    .attachment {
      margin-top: 8px;
    }
    .attachment a {
      color: #00aff4;
      text-decoration: none;
    }
    .attachment a:hover {
      text-decoration: underline;
    }
    .mention {
      padding: 0 2px;
      border-radius: 3px;
      font-weight: 500;
      cursor: pointer;
    }
    .mention.user {
      color: #dee0fc;
      background: rgba(88, 101, 242, 0.3);
    }
    .mention.role {
      padding: 0 4px;
      border-radius: 3px;
    }
    .mention.channel {
      color: #dee0fc;
      background: rgba(88, 101, 242, 0.3);
    }
    .embed {
      background: #2f3136;
      border-left: 4px solid #5865f2;
      border-radius: 4px;
      padding: 12px;
      margin-top: 8px;
      max-width: 520px;
    }
    .embed-author {
      font-size: 12px;
      color: #fff;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .embed-title {
      color: #00aff4;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .embed-description {
      color: #dcddde;
      font-size: 14px;
      margin-bottom: 8px;
    }
    .embed-fields {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .embed-field {
      flex: 1 1 100%;
    }
    .embed-field.inline {
      flex: 1 1 calc(33% - 8px);
      min-width: 150px;
    }
    .embed-field-name {
      color: #fff;
      font-weight: 600;
      font-size: 13px;
      margin-bottom: 2px;
    }
    .embed-field-value {
      color: #dcddde;
      font-size: 14px;
    }
    .embed-image img {
      max-width: 100%;
      border-radius: 4px;
      margin-top: 8px;
    }
    .embed-thumbnail {
      float: right;
      margin-left: 16px;
    }
    .embed-thumbnail img {
      max-width: 80px;
      border-radius: 4px;
    }
    .embed-footer {
      color: #72767d;
      font-size: 12px;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="header-info">
    <h1>🎫 Transcript - Ticket #${ticketNumber.toString().padStart(4, "0")}</h1>
    <p>Serveur: ${channel.guild.name}</p>
    <p>Créé par: ${ticketUser?.tag ?? "Inconnu"}</p>
    <p>Généré le: ${new Date().toLocaleString("fr-FR")}</p>
    <p>Messages: ${messages.length}</p>
  </div>
  <div class="messages">
    ${messagesHtml}
  </div>
</body>
</html>
    `;

    return { html, messageCount: messages.length };
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Convert Discord markdown to HTML
   */
  private convertMarkdown(text: string): string {
    // Code blocks first (```code```)
    text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre class="code-block"><code>${code.trim()}</code></pre>`;
    });

    // Inline code (`code`)
    text = text.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    // Spoilers (||text||)
    text = text.replace(/\|\|(.+?)\|\|/g, '<span class="spoiler">$1</span>');

    // Bold + Italic (***text***)
    text = text.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");

    // Bold (**text**)
    text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

    // Underline (__text__)
    text = text.replace(/__(.+?)__/g, "<u>$1</u>");

    // Italic (*text* or _text_)
    text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
    text = text.replace(/_(.+?)_/g, "<em>$1</em>");

    // Strikethrough (~~text~~)
    text = text.replace(/~~(.+?)~~/g, "<del>$1</del>");

    // Block quotes (> text)
    text = text.replace(/^&gt;\s?(.+)$/gm, '<div class="quote">$1</div>');

    // Line breaks
    text = text.replace(/\n/g, "<br>");

    return text;
  }

  /**
   * Send review to public channel
   */
  async publishReview(ticketId: number, review: string, rating: number): Promise<boolean> {
    const ticket = await this.client.db.ticket.findUnique({
      where: { id: ticketId },
      include: { guild: true },
    });

    if (!ticket?.guild.ticketPublicReviewChannel) return false;

    const guild = this.client.guilds.cache.get(ticket.guildId);
    if (!guild) return false;

    const publicChannel = guild.channels.cache.get(ticket.guild.ticketPublicReviewChannel) as TextChannel;
    if (!publicChannel) return false;

    const user = await this.client.users.fetch(ticket.userId).catch(() => null);
    const stars = "⭐".repeat(rating) + "☆".repeat(5 - rating);

    await publicChannel.send({
      ...createMessage({
        title: "💬 Nouvel avis",
        description: [
          `**De:** ${user?.tag ?? "Anonyme"}`,
          `**Note:** ${stars}`,
          "",
          `> ${review}`,
        ].join("\n"),
        color: "Success",
        footer: `Ticket #${ticket.number.toString().padStart(4, "0")}`,
      }),
    });

    // Update ticket with review
    await this.client.db.ticket.update({
      where: { id: ticketId },
      data: {
        status: "review",
        review,
        reviewRating: rating,
      },
    });

    return true;
  }

  /**
   * Format duration between two dates
   */
  private formatDuration(start: Date, end: Date): string {
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  /**
   * Auto-close inactive tickets (called by scheduler)
   */
  async autoCloseInactiveTickets(): Promise<number> {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    // Find all open tickets that have been inactive for 2+ days
    const inactiveTickets = await this.client.db.ticket.findMany({
      where: {
        status: "open",
        lastActivity: { lt: twoDaysAgo },
      },
    });

    let closedCount = 0;

    for (const ticket of inactiveTickets) {
      try {
        const guild = this.client.guilds.cache.get(ticket.guildId);
        if (!guild) continue;

        const channel = guild.channels.cache.get(ticket.channelId) as TextChannel | undefined;
        if (!channel) {
          // Channel already deleted, just update DB
          await this.client.db.ticket.update({
            where: { id: ticket.id },
            data: { status: "closed", closedAt: new Date() },
          });
          closedCount++;
          continue;
        }

        // Send warning message
        await channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("⏰ Fermeture automatique")
              .setDescription("Ce ticket a été fermé automatiquement car il est inactif depuis plus de 2 jours.")
              .setColor(Colors.Warning)
              .setTimestamp(),
          ],
        });

        // Close the ticket
        await this.closeTicket(channel, this.client.user!);
        closedCount++;
      } catch (error) {
        // Log error but continue with other tickets
        console.error(`Failed to auto-close ticket ${ticket.id}:`, error);
      }
    }

    return closedCount;
  }

  /**
   * Update last activity for a ticket
   */
  async updateLastActivity(channelId: string): Promise<void> {
    await this.client.db.ticket.updateMany({
      where: { channelId, status: "open" },
      data: { lastActivity: new Date() },
    });
  }

  /**
   * Start auto-close scheduler (runs every hour)
   */
  startAutoCloseScheduler(): void {
    // Run every hour
    setInterval(async () => {
      const closed = await this.autoCloseInactiveTickets();
      if (closed > 0) {
        console.log(`[TicketService] Auto-closed ${closed} inactive ticket(s)`);
      }
    }, 60 * 60 * 1000); // 1 hour

    // Also run once on startup (after 10 seconds to let bot connect)
    setTimeout(async () => {
      const closed = await this.autoCloseInactiveTickets();
      if (closed > 0) {
        console.log(`[TicketService] Auto-closed ${closed} inactive ticket(s) on startup`);
      }
    }, 10000);
  }
}
