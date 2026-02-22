import { ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel, EmbedBuilder } from "discord.js";
import type { ButtonComponent } from "../../types/index.js";
import { errorMessage, Colors } from "../../utils/index.js";

export default {
  customId: "review_accept",

  async execute(interaction, client) {
    // Extract ticket ID from custom ID (review_accept_123)
    const ticketId = parseInt(interaction.customId.split("_")[2]!);

    if (isNaN(ticketId)) {
      return interaction.reply({
        ...errorMessage({ description: "Invalid ticket ID." }),
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

    if (!ticket.review || !ticket.reviewRating) {
      return interaction.reply({
        ...errorMessage({ description: "No review to publish for this ticket." }),
        ephemeral: true,
      });
    }

    // Publish to public channel
    if (ticket.guild.ticketPublicReviewChannel) {
      const publicChannel = interaction.guild?.channels.cache.get(
        ticket.guild.ticketPublicReviewChannel
      ) as TextChannel;

      if (publicChannel) {
        const user = await client.users.fetch(ticket.userId).catch(() => null);
        const stars = "⭐".repeat(ticket.reviewRating) + "☆".repeat(5 - ticket.reviewRating);

        const aiSummary = await client.db.ticketSummary.findUnique({
          where: { ticketId: ticket.id },
        }).catch(() => null);

        let miniContext = "";
        if (aiSummary && aiSummary.summary) {
          const firstSentence = aiSummary.summary.split('.')[0] || "";
          miniContext = firstSentence.substring(0, 100) + (firstSentence.length > 100 ? "..." : "");
        } else if (ticket.subject) {
          miniContext = ticket.subject.substring(0, 100);
        }

        const reviewEmbed = new EmbedBuilder()
          .setTitle("💬 New Review")
          .setDescription([
            `**From:** <@${user?.id ?? ticket.userId}>`,
            `**Rating:** ${stars}`,
            ...(miniContext ? [`**Context:** ${miniContext}`] : []),
            "",
            `> ${ticket.review}`,
          ].join("\n"))
          .setColor(Colors.Success)
          .setTimestamp();

        await publicChannel.send({ embeds: [reviewEmbed] });
      }
    }

    // Update ticket status
    await client.db.ticket.update({
      where: { id: ticketId },
      data: { status: "review_published" },
    });

    // Update the message
    await interaction.update({
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`review_done_${ticketId}`)
            .setLabel(`Accepted by ${interaction.user.username}`)
            .setStyle(ButtonStyle.Success)
            .setDisabled(true)
        ),
      ],
    });
  },
} satisfies ButtonComponent;
