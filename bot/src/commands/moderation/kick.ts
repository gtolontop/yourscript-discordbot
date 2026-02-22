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
} from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a user from the server")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((opt) =>
      opt
        .setName("user")
        .setDescription("The user to kick")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("Reason for the kick"),
    ),

  async execute(interaction, client) {
    const target = interaction.options.getUser("user", true);
    const reason =
      interaction.options.getString("reason") ?? "No reason provided";
    const member = interaction.member as GuildMember;
    const targetMember = interaction.guild?.members.cache.get(target.id);

    if (!targetMember) {
      return interaction.reply({
        ...errorMessage({
          description: "This user is not in the server.",
        }),
        ephemeral: true,
      });
    }

    if (!canModerate(member, targetMember)) {
      return interaction.reply({
        ...errorMessage({
          description:
            "You cannot kick this user (role hierarchy).",
        }),
        ephemeral: true,
      });
    }

    if (!botCanModerate(targetMember)) {
      return interaction.reply({
        ...errorMessage({
          description:
            "I cannot kick this user (role hierarchy).",
        }),
        ephemeral: true,
      });
    }

    try {
      await targetMember.kick(`${reason} | By ${interaction.user.tag}`);

      await interaction.reply(
        successMessage({
          title: "User Kicked",
          description: `**${target.tag}** has been kicked.\n**Reason:** ${reason}`,
        }),
      );
    } catch (error) {
      console.error("Kick error:", error);
      await interaction.reply({
        ...errorMessage({
          description: "Failed to kick this user.",
        }),
        ephemeral: true,
      });
    }
  },
} satisfies Command;
