import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import type { ButtonComponent } from "../../types/index.js";
import { successMessage, errorMessage, Colors } from "../../utils/index.js";

export default {
  customId: "review_request",

  async execute(interaction, client) {
    // Extract ticket ID from customId (review_request_123)
    const ticketId = parseInt(interaction.customId.split("_")[2]!);

    if (isNaN(ticketId)) {
      return interaction.reply({
        ...errorMessage({ description: "Invalid ticket ID." }),
        ephemeral: true,
      });
    }

    const ticket = await client.db.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      return interaction.reply({
        ...errorMessage({ description: "Ticket not found." }),
        ephemeral: true,
      });
    }

    // Check if already requested
    if (ticket.status === "review_pending") {
      return interaction.reply({
        ...errorMessage({ description: "A review has already been requested for this ticket." }),
        ephemeral: true,
      });
    }

    // Try to send DM to user
    try {
      const user = await client.users.fetch(ticket.userId);

      const embed = new EmbedBuilder()
        .setTitle("💬 Give your feedback!")
        .setDescription([
          `Thank you for using the support of **${interaction.guild?.name}**!`,
          "",
          `**Ticket:** #${ticket.number.toString().padStart(4, "0")}`,
          ticket.subject ? `**Subject:** ${ticket.subject}` : null,
          "",
          "We would love to hear your feedback about the support quality.",
          "Click the button below to leave us a comment!",
        ].filter(Boolean).join("\n"))
        .setColor(Colors.Primary)
        .setFooter({ text: interaction.guild?.name ?? "Support" });

      const button = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`review_write_${ticket.id}_${interaction.guildId}`)
          .setLabel("Give my feedback")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("⭐")
      );

      await user.send({ embeds: [embed], components: [button] });

      // Update ticket status
      await client.db.ticket.update({
        where: { id: ticketId },
        data: { status: "review_pending" },
      });

      // Rebuild with the link button intact + updated feedback button
      const transcriptUrl = interaction.message.embeds?.[0]?.description?.match(/\[View transcript online\]\((.*?)\)/)?.[1];
      const updatedButtons = new ActionRowBuilder<ButtonBuilder>();

      if (transcriptUrl) {
        updatedButtons.addComponents(
          new ButtonBuilder()
            .setLabel("View online")
            .setStyle(ButtonStyle.Link)
            .setURL(transcriptUrl)
            .setEmoji("🌐")
        );
      }

      updatedButtons.addComponents(
        new ButtonBuilder()
          .setCustomId(`review_request_${ticket.id}`)
          .setLabel(`Feedback requested by ${interaction.user.username}`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("✅")
          .setDisabled(true)
      );

      await interaction.update({ components: [updatedButtons] });
    } catch {
      return interaction.reply({
        ...errorMessage({ description: "Unable to send a DM to this user (DMs closed)." }),
        ephemeral: true,
      });
    }
  },
} satisfies ButtonComponent;
