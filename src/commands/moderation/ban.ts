import { SlashCommandBuilder, PermissionFlagsBits, GuildMember } from "discord.js";
import type { Command } from "../../types/index.js";
import { errorMessage, successMessage } from "../../utils/index.js";
import { ModerationService } from "../../services/ModerationService.js";
import { canModerate, botCanModerate } from "../../utils/permissions.js";

export default {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Bannit un utilisateur du serveur")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((opt) =>
      opt.setName("user").setDescription("L'utilisateur à bannir").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("raison").setDescription("Raison du bannissement")
    )
    .addIntegerOption((opt) =>
      opt
        .setName("delete_messages")
        .setDescription("Supprimer les messages des X derniers jours")
        .setMinValue(0)
        .setMaxValue(7)
    ),

  async execute(interaction, client) {
    const target = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("raison") ?? "Aucune raison fournie";
    const deleteMessages = interaction.options.getInteger("delete_messages") ?? 0;
    const member = interaction.member as GuildMember;
    const targetMember = interaction.guild?.members.cache.get(target.id);

    // Check permissions
    if (targetMember) {
      if (!canModerate(member, targetMember)) {
        return interaction.reply({
          ...errorMessage({ description: "Tu ne peux pas bannir cet utilisateur (hiérarchie des rôles)." }),
          ephemeral: true,
        });
      }

      if (!botCanModerate(targetMember)) {
        return interaction.reply({
          ...errorMessage({ description: "Je ne peux pas bannir cet utilisateur (hiérarchie des rôles)." }),
          ephemeral: true,
        });
      }
    }

    try {
      await interaction.guild?.members.ban(target, {
        reason: `${reason} | Par ${interaction.user.tag}`,
        deleteMessageSeconds: deleteMessages * 24 * 60 * 60,
      });

      // Send log
      const modService = new ModerationService(client);
      await modService.logBan(interaction.guild!, target, interaction.user, reason);

      await interaction.reply(
        successMessage({
          title: "Utilisateur banni",
          description: `**${target.tag}** a été banni.\n**Raison:** ${reason}`,
        })
      );
    } catch (error) {
      await interaction.reply({
        ...errorMessage({ description: "Impossible de bannir cet utilisateur." }),
        ephemeral: true,
      });
    }
  },
} satisfies Command;
