import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import type { ButtonComponent } from "../../types/index.js";
import { errorMessage, Colors } from "../../utils/index.js";

// Track user votes in memory (could be moved to DB for persistence)
const userVotes = new Map<string, Map<string, "up" | "down">>();

export default {
  customId: /^suggestion_(upvote|downvote)$/,

  async execute(interaction, client) {
    const messageId = interaction.message.id;
    const isUpvote = interaction.customId === "suggestion_upvote";

    const suggestion = await client.db.suggestion.findUnique({
      where: { messageId },
    });

    if (!suggestion) {
      return interaction.reply({
        ...errorMessage({ description: "Suggestion not found." }),
        ephemeral: true,
      });
    }

    if (suggestion.status !== "pending") {
      return interaction.reply({
        ...errorMessage({ description: "This suggestion has already been processed." }),
        ephemeral: true,
      });
    }

    if (!interaction.message.embeds[0]) {
      return interaction.reply({
        ...errorMessage({ description: "Embed not found." }),
        ephemeral: true,
      });
    }

    // Get or create vote tracking for this message
    if (!userVotes.has(messageId)) {
      userVotes.set(messageId, new Map());
    }
    const messageVotes = userVotes.get(messageId)!;
    const previousVote = messageVotes.get(interaction.user.id);

    let upvotes = suggestion.upvotes;
    let downvotes = suggestion.downvotes;

    // Handle vote logic
    if (previousVote === (isUpvote ? "up" : "down")) {
      // Remove vote
      if (isUpvote) upvotes--;
      else downvotes--;
      messageVotes.delete(interaction.user.id);
    } else {
      // Remove previous vote if switching
      if (previousVote === "up") upvotes--;
      else if (previousVote === "down") downvotes--;

      // Add new vote
      if (isUpvote) upvotes++;
      else downvotes++;
      messageVotes.set(interaction.user.id, isUpvote ? "up" : "down");
    }

    // Update in DB
    await client.db.suggestion.update({
      where: { messageId },
      data: { upvotes, downvotes },
    });

    // Update message
    const embed = EmbedBuilder.from(interaction.message.embeds[0]);
    embed.spliceFields(1, 1, {
      name: "Votes",
      value: `👍 ${upvotes} | 👎 ${downvotes}`,
      inline: true,
    });

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
        .setEmoji("👎")
    );

    await interaction.update({
      embeds: [embed],
      components: [buttons],
    });
  },
} satisfies ButtonComponent;
