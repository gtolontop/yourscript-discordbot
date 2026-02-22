import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";
import type { Command } from "../../types/index.js";
import { errorMessage, successMessage } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Bulk delete messages from a channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((opt) =>
      opt
        .setName("amount")
        .setDescription("Number of messages to delete (1-100)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100),
    )
    .addUserOption((opt) =>
      opt
        .setName("user")
        .setDescription("Only delete messages from this user"),
    ),

  async execute(interaction, client) {
    const amount = interaction.options.getInteger("amount", true);
    const targetUser = interaction.options.getUser("user");
    const channel = interaction.channel as TextChannel;

    await interaction.deferReply({ ephemeral: true });

    try {
      let messages = await channel.messages.fetch({ limit: 100 });

      // Filter by user if specified
      if (targetUser) {
        messages = messages.filter((m) => m.author.id === targetUser.id);
      }

      // Filter out messages older than 14 days (Discord limitation)
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      messages = messages.filter((m) => m.createdTimestamp > twoWeeksAgo);

      // Limit to requested amount
      const toDelete = messages.first(amount);

      if (toDelete.length === 0) {
        return interaction.editReply(
          errorMessage({
            description: "No messages found to delete.",
          }),
        );
      }

      const deleted = await channel.bulkDelete(toDelete, true);

      await interaction.editReply(
        successMessage({
          description: `Successfully deleted **${deleted.size}** message(s).${targetUser ? ` (from ${targetUser.tag})` : ""}`,
        }),
      );
    } catch (error) {
      console.error("Clear error:", error);
      await interaction.editReply(
        errorMessage({
          description: "Failed to delete messages.",
        }),
      );
    }
  },
} satisfies Command;
