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
  customId: /^suggestion_(upvote|downvote)$/,

  async execute(interaction, client: Bot) {
    const guildId = interaction.guildId!;
    const isUpvote = interaction.customId === "suggestion_upvote";
    const voteType = isUpvote ? "up" : "down";

    try {
      // We need to find the suggestion by message ID
      // The suggestion ID is typically derived from the message
      // For now, we attempt to vote and update the embed
      const messageId = interaction.message.id;

      if (!interaction.message.embeds[0]) {
        await interaction.reply({
          content: "Embed not found.",
          ephemeral: true,
        });
        return;
      }

      // Extract suggestion ID from the embed footer if present
      const footer = interaction.message.embeds[0].footer?.text ?? "";
      const idMatch = footer.match(/ID:\s*(\d+)/);

      if (!idMatch) {
        await interaction.reply({
          content: "Could not identify this suggestion.",
          ephemeral: true,
        });
        return;
      }

      const suggestionId = parseInt(idMatch[1]!);

      // Vote via the backend
      await client.api.voteSuggestion(guildId, suggestionId, voteType);

      // Rebuild the embed with updated counts
      // The backend handles vote toggling, so we need to trust the response
      // We update the buttons to reflect the action
      const embed = EmbedBuilder.from(interaction.message.embeds[0]);

      // Parse current votes from button labels and adjust
      const currentButtons = interaction.message.components[0]?.components;
      let upvotes = 0;
      let downvotes = 0;

      if (currentButtons && currentButtons.length >= 2) {
        upvotes = parseInt((currentButtons[0] as any).label ?? "0") || 0;
        downvotes = parseInt((currentButtons[1] as any).label ?? "0") || 0;
      }

      if (isUpvote) {
        upvotes++;
      } else {
        downvotes++;
      }

      // Update the vote field in the embed if it exists
      const fieldIndex = embed.data.fields?.findIndex(
        (f) => f.name === "Votes",
      );
      if (fieldIndex !== undefined && fieldIndex >= 0) {
        embed.spliceFields(fieldIndex, 1, {
          name: "Votes",
          value: `👍 ${upvotes} | 👎 ${downvotes}`,
          inline: true,
        });
      }

      const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("suggestion_upvote")
          .setLabel(upvotes.toString())
          .setStyle(ButtonStyle.Success)
          .setEmoji("👍"),
        new ButtonBuilder()
          .setCustomId("suggestion_downvote")
          .setLabel(downvotes.toString())
          .setStyle(ButtonStyle.Danger)
          .setEmoji("👎"),
      );

      await interaction.update({
        embeds: [embed],
        components: [buttons],
      });
    } catch (error) {
      logger.error("Failed to process suggestion vote:", error);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "An error occurred while processing your vote.",
          ephemeral: true,
        });
      }
    }
  },
} satisfies ButtonComponent;
