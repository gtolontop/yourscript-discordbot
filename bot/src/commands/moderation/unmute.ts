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
    .setName("unmute")
    .setDescription("Remove timeout (unmute) from a user")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) =>
      opt
        .setName("user")
        .setDescription("The user to unmute")
        .setRequired(true),
    ),

  async execute(interaction, client) {
    const target = interaction.options.getUser("user", true);
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

    if (!targetMember.isCommunicationDisabled()) {
      return interaction.reply({
        ...errorMessage({
          description: "This user is not muted.",
        }),
        ephemeral: true,
      });
    }

    if (!canModerate(member, targetMember)) {
      return interaction.reply({
        ...errorMessage({
          description:
            "You cannot unmute this user (role hierarchy).",
        }),
        ephemeral: true,
      });
    }

    if (!botCanModerate(targetMember)) {
      return interaction.reply({
        ...errorMessage({
          description:
            "I cannot unmute this user (role hierarchy).",
        }),
        ephemeral: true,
      });
    }

    try {
      await targetMember.timeout(null);

      await interaction.reply(
        successMessage({
          title: "User Unmuted",
          description: `**${target.tag}** has been unmuted.`,
        }),
      );
    } catch (error) {
      console.error("Unmute error:", error);
      await interaction.reply({
        ...errorMessage({
          description: "Failed to unmute this user.",
        }),
        ephemeral: true,
      });
    }
  },
} satisfies Command;
