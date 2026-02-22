import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  EmbedBuilder,
} from "discord.js";
import type { ModalComponent } from "../../types/index.js";
import { successMessage, errorMessage, warningMessage, Colors } from "../../utils/index.js";
import { TicketService } from "../../services/TicketService.js";

export default {
  customId: "closereview_submit",

  async execute(interaction, client) {
    const parts = interaction.customId.split("_");
    const ticketId = parseInt(parts[2]!);
    const guildId = parts[3];

    if (isNaN(ticketId) || !guildId) {
      return interaction.reply({
        ...errorMessage({ description: "Invalid data." }),
        ephemeral: true,
      });
    }

    const ratingStr = interaction.fields.getTextInputValue("rating");
    const review = interaction.fields.getTextInputValue("review");

    const rating = parseInt(ratingStr);
    if (isNaN(rating) || rating < 1 || rating > 5) {
      return interaction.reply({
        ...errorMessage({ description: "The rating must be a number between 1 and 5." }),
        ephemeral: true,
      });
    }

    const ticket = await client.db.ticket.findUnique({
      where: { id: ticketId },
      include: { guild: true },
    });

    if (!ticket) {
      return interaction.reply({
        ...errorMessage({ description: "Ticket not found." }),
        ephemeral: true,
      });
    }

    await interaction.reply({
      ...successMessage({ description: "Thanks for your review! Closing the ticket..." }),
      ephemeral: true,
    });

    // Store the review
    await client.db.ticket.update({
      where: { id: ticketId },
      data: {
        review,
        reviewRating: rating,
        status: "review_submitted",
      },
    });

    // Now close the ticket first, so transcript and summary are generated
    const channel = interaction.channel as TextChannel;
    if (channel) {
      const ticketService = new TicketService(client);
      await ticketService.closeTicket(channel, interaction.user);
    }

    // Wait a brief moment to ensure DB records are written
    await new Promise(r => setTimeout(r, 1000));

    // Send to review channel for staff approval
    const guild = client.guilds.cache.get(guildId);
    if (guild && ticket.guild.ticketReviewChannel) {
      const reviewChannel = guild.channels.cache.get(ticket.guild.ticketReviewChannel) as TextChannel;
      if (reviewChannel) {
        const stars = "\u2B50".repeat(rating) + "\u2606".repeat(5 - rating);

        const transcript = await client.db.transcript.findFirst({
          where: { ticketId: ticket.id },
          orderBy: { createdAt: 'desc' },
        });

        const aiSummary = await client.db.ticketSummary.findUnique({
          where: { ticketId: ticket.id },
        });

        const webUrl = process.env['WEB_URL'] ?? `http://localhost:${process.env['WEB_PORT'] ?? 3000}`;
        const transcriptUrl = transcript ? `${webUrl}/transcript/${transcript.id}` : null;
        const transcriptLink = transcriptUrl ? `[View online](${transcriptUrl})` : "Not available";
        
        // Since we know who closed it (interaction.user)
        const closedBy = `<@${interaction.user.id}>`;

        const reviewEmbed = new EmbedBuilder()
          .setTitle(`\u2B50 Review Received - Ticket #${ticket.number.toString().padStart(4, "0")}`)
          .setDescription([
            `**From:** <@${interaction.user.id}>`,
            `**Rating:** ${stars}`,
            `**Subject:** ${ticket.subject ?? "None"}`,
            `**Closed By:** ${closedBy}`,
            `**Transcript:** ${transcriptLink}`,
            "",
            ...(aiSummary ? [`**AI Summary:** ${aiSummary.summary.substring(0, 300)}${aiSummary.summary.length > 300 ? "..." : ""}`, ""] : []),
            `**User Review:**`,
            `> ${review}`,
          ].join("\n"))
          .setColor(Colors.Warning)
          .setTimestamp();

        const approvalButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`review_accept_${ticket.id}`)
            .setLabel("Accept")
            .setStyle(ButtonStyle.Success)
            .setEmoji("\u2705"),
          new ButtonBuilder()
            .setCustomId(`review_refuse_${ticket.id}`)
            .setLabel("Decline")
            .setStyle(ButtonStyle.Danger)
            .setEmoji("\u274C")
        );

        await reviewChannel.send({
          embeds: [reviewEmbed],
          components: [approvalButtons],
        });
      }
    }

    // Emit review:submitted to AI namespace
    if (client.aiNamespace) {
      client.aiNamespace.emit("review:submitted", {
        ticketId,
        guildId: guildId!,
        userId: interaction.user.id,
        rating,
        review,
      });
    }

  },
} satisfies ModalComponent;
