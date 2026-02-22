import { SlashCommandBuilder, PermissionFlagsBits, GuildMember } from "discord.js";
import type { Command } from "../../types/index.js";
import { errorMessage, successMessage } from "../../utils/index.js";
import { ModerationService } from "../../services/ModerationService.js";
import { canModerate, botCanModerate } from "../../utils/permissions.js";

export default {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user from the server")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((opt) =>
      opt.setName("user").setDescription("The user to ban").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("raison").setDescription("Reason for the ban")
    )
    .addIntegerOption((opt) =>
      opt
        .setName("delete_messages")
        .setDescription("Delete messages from the last X days")
        .setMinValue(0)
        .setMaxValue(7)
    ),

  async execute(interaction, client) {
    const target = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("raison") ?? "No reason provided";
    const deleteMessages = interaction.options.getInteger("delete_messages") ?? 0;
    const member = interaction.member as GuildMember;
    const targetMember = interaction.guild?.members.cache.get(target.id);

    // Check permissions
    if (targetMember) {
      if (!canModerate(member, targetMember)) {
        return interaction.reply({
          ...errorMessage({ description: "You cannot ban this user (role hierarchy)." }),
          ephemeral: true,
        });
      }

      if (!botCanModerate(targetMember)) {
        return interaction.reply({
          ...errorMessage({ description: "I cannot ban this user (role hierarchy)." }),
          ephemeral: true,
        });
      }
    }

    try {
      await interaction.guild?.members.ban(target, {
        reason: `${reason} | By ${interaction.user.tag}`,
        deleteMessageSeconds: deleteMessages * 24 * 60 * 60,
      });

      // Send log
      const modService = new ModerationService(client);
      await modService.logBan(interaction.guild!, target, interaction.user, reason);

      await interaction.reply(
        successMessage({
          title: "User Banned",
          description: `**${target.tag}** has been banned.\n**Reason:** ${reason}`,
        })
      );
    } catch (error) {
      await interaction.reply({
        ...errorMessage({ description: "Unable to ban this user." }),
        ephemeral: true,
      });
    }
  },
} satisfies Command;
