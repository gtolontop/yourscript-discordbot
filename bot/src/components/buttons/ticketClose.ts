import {
  type TextChannel,
  type Message,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} from "discord.js";
import type { ButtonComponent } from "../../types/index.js";
import { Bot } from "../../client/Bot.js";
import { logger } from "../../utils/logger.js";

/**
 * Generate a simple HTML transcript from channel messages.
 */
async function generateTranscript(
  channel: TextChannel,
  ticketNumber: number,
): Promise<{ html: string; messageCount: number }> {
  const messages: Message[] = [];
  let lastId: string | undefined;

  // Fetch up to 500 messages
  while (messages.length < 500) {
    const fetched = await channel.messages.fetch({
      limit: 100,
      ...(lastId && { before: lastId }),
    });
    if (fetched.size === 0) break;
    messages.push(...fetched.values());
    lastId = fetched.last()?.id;
  }

  messages.reverse();

  const escapeHtml = (text: string) =>
    text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const messagesHtml = messages
    .map((msg) => {
      const time = msg.createdAt.toLocaleString("en-US");
      const author = msg.author?.tag ?? "Unknown";
      const avatarUrl = msg.author?.displayAvatarURL({ size: 64 }) ?? "";
      const isBot = msg.author?.bot ?? false;
      const content = escapeHtml(msg.content).replace(/\n/g, "<br>");

      const attachments = msg.attachments
        .map((att) => {
          if (att.contentType?.startsWith("image/")) {
            return `<div class="attachment"><img src="${att.url}" alt="Image" style="max-width:400px;border-radius:8px;"></div>`;
          }
          return `<div class="attachment"><a href="${att.url}" target="_blank">Attachment: ${att.name}</a></div>`;
        })
        .join("");

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
          </div>
        </div>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transcript - Ticket #${ticketNumber.toString().padStart(4, "0")}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; background:#36393f; color:#dcddde; line-height:1.5; }
    .header-info { background:#2f3136; padding:20px; border-bottom:1px solid #202225; }
    .header-info h1 { color:#fff; font-size:24px; margin-bottom:10px; }
    .header-info p { color:#b9bbbe; font-size:14px; }
    .messages { padding:20px; }
    .message { display:flex; padding:8px 0; margin:4px 0; }
    .message:hover { background:#32353b; }
    .avatar { width:40px; height:40px; border-radius:50%; margin-right:16px; flex-shrink:0; }
    .content { flex:1; min-width:0; }
    .header { display:flex; align-items:center; gap:8px; margin-bottom:4px; }
    .author { font-weight:500; color:#fff; }
    .author.bot { color:#5865f2; }
    .bot-tag { background:#5865f2; color:#fff; font-size:10px; padding:1px 4px; border-radius:3px; font-weight:600; }
    .timestamp { color:#72767d; font-size:12px; }
    .text { color:#dcddde; word-wrap:break-word; }
    .attachment { margin-top:8px; }
    .attachment a { color:#00aff4; text-decoration:none; }
    .attachment a:hover { text-decoration:underline; }
  </style>
</head>
<body>
  <div class="header-info">
    <h1>Transcript - Ticket #${ticketNumber.toString().padStart(4, "0")}</h1>
    <p>Server: ${channel.guild.name}</p>
    <p>Generated: ${new Date().toLocaleString("en-US")}</p>
    <p>Messages: ${messages.length}</p>
  </div>
  <div class="messages">${messagesHtml}</div>
</body>
</html>`;

  return { html, messageCount: messages.length };
}

export default {
  customId: /^ticket_close/,

  async execute(interaction, client: Bot) {
    const guildId = interaction.guildId!;
    const channelId = interaction.channelId;

    try {
      // Find the ticket for this channel
      const tickets = await client.api.listTickets(guildId, "open");
      const ticket = tickets.tickets.find((t) => t.channel_id === channelId);

      if (!ticket) {
        await interaction.reply({
          content: "No open ticket found for this channel.",
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply();

      // Close ticket via the backend
      await client.api.closeTicket(guildId, ticket.id, interaction.user.id);

      // Generate transcript
      const channel = interaction.channel as TextChannel;
      const { html, messageCount } = await generateTranscript(
        channel,
        ticket.number,
      );

      // Send transcript to configured channel
      try {
        const config = await client.api.getGuildConfig(guildId);

        if (config.ticket_transcript_channel) {
          const transcriptChannel = interaction.guild?.channels.cache.get(
            config.ticket_transcript_channel,
          ) as TextChannel | undefined;

          if (transcriptChannel) {
            const ticketUser = await client.users
              .fetch(ticket.user_id)
              .catch(() => null);

            const transcriptFile = new AttachmentBuilder(
              Buffer.from(html, "utf-8"),
              {
                name: `transcript-ticket-${ticket.number.toString().padStart(4, "0")}.html`,
              },
            );

            const transcriptEmbed = new EmbedBuilder()
              .setTitle(
                `Transcript - Ticket #${ticket.number.toString().padStart(4, "0")}`,
              )
              .setDescription(
                [
                  `**Created by:** ${ticketUser?.tag ?? "Unknown"} (<@${ticket.user_id}>)`,
                  `**Closed by:** ${interaction.user.tag}`,
                  `**Subject:** ${ticket.subject ?? "None"}`,
                  `**Category:** ${ticket.category ?? "None"}`,
                  `**Messages:** ${messageCount}`,
                ].join("\n"),
              )
              .setColor(0x5865f2)
              .setTimestamp();

            const buttons =
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                  .setCustomId(`review_request_${ticket.id}`)
                  .setLabel("Request Review")
                  .setStyle(ButtonStyle.Primary)
                  .setEmoji("💬"),
              );

            await transcriptChannel.send({
              embeds: [transcriptEmbed],
              files: [transcriptFile],
              components: [buttons],
            });
          }
        }
      } catch (error) {
        logger.error("Failed to send transcript:", error);
      }

      // Notify in channel and delete after 5 seconds
      const closeEmbed = new EmbedBuilder()
        .setDescription(
          "Ticket closed. This channel will be deleted in 5 seconds...",
        )
        .setColor(0x57f287)
        .setTimestamp();

      await interaction.editReply({ embeds: [closeEmbed] });

      setTimeout(async () => {
        await channel.delete().catch(() => {});
      }, 5000);
    } catch (error) {
      logger.error("Failed to close ticket:", error);

      const reply = {
        content: "An error occurred while closing this ticket.",
        ephemeral: true,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply).catch(() => {});
      } else {
        await interaction.reply(reply).catch(() => {});
      }
    }
  },
} satisfies ButtonComponent;
