import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  EmbedBuilder,
} from "discord.js";
import type { ModalComponent } from "../../types/index.js";
import { successMessage, errorMessage, Colors } from "../../utils/index.js";

export default {
  customId: "review_submit",

  async execute(interaction, client) {
    // Extract ticket ID and guild ID from customId (review_submit_123_456)
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

    // Validate rating
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

    // Store the review temporarily (not yet published)
    await client.db.ticket.update({
      where: { id: ticketId },
      data: {
        review,
        reviewRating: rating,
        status: "review_submitted",
      },
    });

    // Send to review channel for staff approval
    const guild = client.guilds.cache.get(guildId);
    if (guild && ticket.guild.ticketReviewChannel) {
      const reviewChannel = guild.channels.cache.get(ticket.guild.ticketReviewChannel) as TextChannel;
      if (reviewChannel) {
        const stars = "⭐".repeat(rating) + "☆".repeat(5 - rating);

        const reviewEmbed = new EmbedBuilder()
          .setTitle(`⭐ Review Received - Ticket #${ticket.number.toString().padStart(4, "0")}`)
          .setDescription([
            `**From:** ${interaction.user.tag} (<@${interaction.user.id}>)`,
            `**Rating:** ${stars}`,
            "",
            `> ${review}`,
          ].join("\n"))
          .setColor(Colors.Warning)
          .setTimestamp();

        const approvalButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`review_accept_${ticket.id}`)
            .setLabel("Accept")
            .setStyle(ButtonStyle.Success)
            .setEmoji("✅"),
          new ButtonBuilder()
            .setCustomId(`review_refuse_${ticket.id}`)
            .setLabel("Decline")
            .setStyle(ButtonStyle.Danger)
            .setEmoji("❌")
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

    // Reply to the user
    await interaction.reply(
      successMessage({
        description: "Thank you for your feedback! It will be reviewed by the staff.",
      })
    );
  },
} satisfies ModalComponent;
