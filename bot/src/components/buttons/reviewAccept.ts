import {
  type TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import type { ButtonComponent } from "../../types/index.js";
import { Bot } from "../../client/Bot.js";
import { logger } from "../../utils/logger.js";

export default {
  customId: /^review_accept_/,

  async execute(interaction, client: Bot) {
    // Extract ticket ID from custom ID (review_accept_123)
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

      if (!ticket.review || !ticket.review_rating) {
        await interaction.reply({
          content: "No review to publish for this ticket.",
          ephemeral: true,
        });
        return;
      }

      // Publish review to public channel
      const config = await client.api.getGuildConfig(guildId);

      if (config.ticket_public_review_channel) {
        const publicChannel = interaction.guild?.channels.cache.get(
          config.ticket_public_review_channel,
        ) as TextChannel | undefined;

        if (publicChannel) {
          const user = await client.users
            .fetch(ticket.user_id)
            .catch(() => null);
          const stars =
            "\u2B50".repeat(ticket.review_rating) +
            "\u2606".repeat(5 - ticket.review_rating);

          const reviewEmbed = new EmbedBuilder()
            .setTitle("New Review")
            .setDescription(
              [
                `**From:** ${user?.tag ?? "Anonymous"}`,
                `**Rating:** ${stars}`,
                "",
                `> ${ticket.review}`,
              ].join("\n"),
            )
            .setColor(0x57f287)
            .setTimestamp();

          await publicChannel.send({ embeds: [reviewEmbed] });
        }
      }

      // Update the message to show it was accepted
      await interaction.update({
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`review_done_${ticketId}`)
              .setLabel(`Accepted by ${interaction.user.username}`)
              .setStyle(ButtonStyle.Success)
              .setDisabled(true),
          ),
        ],
      });
    } catch (error) {
      logger.error("Failed to accept review:", error);
      await interaction.reply({
        content: "An error occurred while publishing the review.",
        ephemeral: true,
      });
    }
  },
} satisfies ButtonComponent;
