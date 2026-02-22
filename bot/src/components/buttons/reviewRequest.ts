import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import type { ButtonComponent } from "../../types/index.js";
import { Bot } from "../../client/Bot.js";
import { logger } from "../../utils/logger.js";

export default {
  customId: /^review_request_/,

  async execute(interaction, client: Bot) {
    // Extract ticket ID from customId (review_request_123)
    const ticketId = parseInt(interaction.customId.split("_")[2]!);
    const guildId = interaction.guildId!;

    if (isNaN(ticketId)) {
      await interaction.reply({
        content: "Invalid ticket ID.",
        ephemeral: true,
      });
      return;
    }

    try {
      const ticket = await client.api.getTicket(guildId, ticketId);

      if (!ticket) {
        await interaction.reply({
          content: "Ticket not found.",
          ephemeral: true,
        });
        return;
      }

      // Try to send DM to ticket creator
      const user = await client.users.fetch(ticket.user_id);

      const embed = new EmbedBuilder()
        .setTitle("Leave a Review!")
        .setDescription(
          [
            `Thank you for using the support of **${interaction.guild?.name}**!`,
            "",
            `**Ticket:** #${ticket.number.toString().padStart(4, "0")}`,
            ticket.subject ? `**Subject:** ${ticket.subject}` : null,
            "",
            "We would love to hear your feedback on the quality of the support you received.",
            "Click the button below to leave a review!",
          ]
            .filter(Boolean)
            .join("\n"),
        )
        .setColor(0x5865f2)
        .setFooter({ text: interaction.guild?.name ?? "Support" });

      const button = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`review_write_${ticket.id}_${guildId}`)
          .setLabel("Write Review")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("⭐"),
      );

      await user.send({ embeds: [embed], components: [button] });

      // Update the original message to show the request was sent
      await interaction.update({
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`review_request_${ticket.id}`)
              .setLabel("Review Requested")
              .setStyle(ButtonStyle.Secondary)
              .setEmoji("✅")
              .setDisabled(true),
          ),
        ],
      });
    } catch (error) {
      logger.error("Failed to send review request:", error);
      await interaction.reply({
        content:
          "Unable to send a DM to this user (DMs may be disabled).",
        ephemeral: true,
      });
    }
  },
} satisfies ButtonComponent;
