import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  GuildMember,
} from "discord.js";
import type { Command } from "../../types/index.js";
import {
  errorMessage,
  successMessage,
  canModerate,
  botCanModerate,
  isAdmin,
} from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user from the server")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((opt) =>
      opt
        .setName("user")
        .setDescription("The user to ban")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("Reason for the ban"),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("delete-messages")
        .setDescription("Number of days of messages to delete (0-7)")
        .setMinValue(0)
        .setMaxValue(7),
    ),

  async execute(interaction, client) {
    const target = interaction.options.getUser("user", true);
    const reason =
      interaction.options.getString("reason") ?? "No reason provided";
    const deleteMessages =
      interaction.options.getInteger("delete-messages") ?? 0;
    const member = interaction.member as GuildMember;

    // Permission check
    if (
      !isAdmin(member) &&
      !member.permissions.has(PermissionFlagsBits.BanMembers)
    ) {
      return interaction.reply({
        ...errorMessage({
          description:
            "You do not have permission to ban members.",
        }),
        ephemeral: true,
      });
    }

    const targetMember = interaction.guild?.members.cache.get(target.id);

    // Hierarchy checks (only if the target is in the server)
    if (targetMember) {
      if (!canModerate(member, targetMember)) {
        return interaction.reply({
          ...errorMessage({
            description:
              "You cannot ban this user (role hierarchy).",
          }),
          ephemeral: true,
        });
      }

      if (!botCanModerate(targetMember)) {
        return interaction.reply({
          ...errorMessage({
            description:
              "I cannot ban this user (role hierarchy).",
          }),
          ephemeral: true,
        });
      }
    }

    try {
      await interaction.guild?.members.ban(target, {
        reason: `${reason} | By ${interaction.user.tag}`,
        deleteMessageSeconds: deleteMessages * 24 * 60 * 60,
      });

      await interaction.reply(
        successMessage({
          title: "User Banned",
          description: `**${target.tag}** has been banned.\n**Reason:** ${reason}`,
        }),
      );
    } catch (error) {
      console.error("Ban error:", error);
      await interaction.reply({
        ...errorMessage({
          description: "Failed to ban this user.",
        }),
        ephemeral: true,
      });
    }
  },
} satisfies Command;
