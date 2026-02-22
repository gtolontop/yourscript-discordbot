import {
  type TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import type { ModalComponent } from "../../types/index.js";
import { Bot } from "../../client/Bot.js";
import { logger } from "../../utils/logger.js";

export default {
  customId: /^review_submit_/,

  async execute(interaction, client: Bot) {
    // Extract ticket ID and guild ID from customId (review_submit_123_456)
    const parts = interaction.customId.split("_");
    const ticketId = parseInt(parts[2]!);
    const guildId = parts[3];

    if (isNaN(ticketId) || !guildId) {
      await interaction.reply({
        content: "Invalid data.",
        ephemeral: true,
      });
      return;
    }

    const ratingStr = interaction.fields.getTextInputValue("rating");
    const review = interaction.fields.getTextInputValue("review");

    // Validate rating
    const rating = parseInt(ratingStr);
    if (isNaN(rating) || rating < 1 || rating > 5) {
      await interaction.reply({
        content: "The rating must be a number between 1 and 5.",
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

      // Get the guild config to find the review channel
      const config = await client.api.getGuildConfig(guildId);

      // Send to review channel for staff approval
      const guild = client.guilds.cache.get(guildId);
      if (guild && config.ticket_review_channel) {
        const reviewChannel = guild.channels.cache.get(
          config.ticket_review_channel,
        ) as TextChannel | undefined;

        if (reviewChannel) {
          const stars =
            "\u2B50".repeat(rating) + "\u2606".repeat(5 - rating);

          const reviewEmbed = new EmbedBuilder()
            .setTitle(
              `Review Received - Ticket #${ticket.number.toString().padStart(4, "0")}`,
            )
            .setDescription(
              [
                `**From:** ${interaction.user.tag} (<@${interaction.user.id}>)`,
                `**Rating:** ${stars}`,
                "",
                `> ${review}`,
              ].join("\n"),
            )
            .setColor(0xfee75c)
            .setTimestamp();

          const approvalButtons =
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId(`review_accept_${ticket.id}`)
                .setLabel("Accept")
                .setStyle(ButtonStyle.Success)
                .setEmoji("✅"),
              new ButtonBuilder()
                .setCustomId(`review_refuse_${ticket.id}`)
                .setLabel("Refuse")
                .setStyle(ButtonStyle.Danger)
                .setEmoji("❌"),
            );

          await reviewChannel.send({
            embeds: [reviewEmbed],
            components: [approvalButtons],
          });
        }
      }

      // Reply to the user
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setDescription(
              "Thank you for your review! It will be reviewed by the staff.",
            )
            .setColor(0x57f287),
        ],
        ephemeral: true,
      });
    } catch (error) {
      logger.error("Failed to submit review:", error);
      await interaction.reply({
        content: "An error occurred while submitting your review.",
        ephemeral: true,
      });
    }
  },
} satisfies ModalComponent;
