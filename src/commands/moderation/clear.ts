import { SlashCommandBuilder, PermissionFlagsBits, TextChannel } from "discord.js";
import type { Command } from "../../types/index.js";
import { errorMessage, successMessage } from "../../utils/index.js";
import { ModerationService } from "../../services/ModerationService.js";

export default {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Supprime des messages")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((opt) =>
      opt
        .setName("nombre")
        .setDescription("Nombre de messages à supprimer (1-100)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .addUserOption((opt) =>
      opt.setName("user").setDescription("Supprimer uniquement les messages de cet utilisateur")
    ),

  async execute(interaction, client) {
    const amount = interaction.options.getInteger("nombre", true);
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
          errorMessage({ description: "Aucun message à supprimer." })
        );
      }

      const deleted = await channel.bulkDelete(toDelete, true);

      // Send log
      const modService = new ModerationService(client);
      await modService.logClear(interaction.guild!, interaction.user, deleted.size, channel.id, targetUser ?? undefined);

      await interaction.editReply(
        successMessage({
          description: `**${deleted.size}** messages supprimés.${targetUser ? ` (de ${targetUser.tag})` : ""}`,
        })
      );
    } catch (error) {
      console.error(error);
      await interaction.editReply(
        errorMessage({ description: "Impossible de supprimer les messages." })
      );
    }
  },
} satisfies Command;
