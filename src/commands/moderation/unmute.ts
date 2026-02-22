import { SlashCommandBuilder, PermissionFlagsBits, GuildMember } from "discord.js";
import type { Command } from "../../types/index.js";
import { errorMessage, successMessage } from "../../utils/index.js";
import { ModerationService } from "../../services/ModerationService.js";
import { canModerate, botCanModerate } from "../../utils/permissions.js";

export default {
  data: new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("Unmute a user")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) =>
      opt.setName("user").setDescription("The user to unmute").setRequired(true)
    ),

  async execute(interaction, client) {
    const target = interaction.options.getUser("user", true);
    const member = interaction.member as GuildMember;
    const targetMember = interaction.guild?.members.cache.get(target.id);

    if (!targetMember) {
      return interaction.reply({
        ...errorMessage({ description: "This user is not on the server." }),
        ephemeral: true,
      });
    }

    if (!targetMember.isCommunicationDisabled()) {
      return interaction.reply({
        ...errorMessage({ description: "This user is not muted." }),
        ephemeral: true,
      });
    }

    if (!canModerate(member, targetMember)) {
      return interaction.reply({
        ...errorMessage({ description: "You cannot unmute this user (role hierarchy)." }),
        ephemeral: true,
      });
    }

    if (!botCanModerate(targetMember)) {
      return interaction.reply({
        ...errorMessage({ description: "I cannot unmute this user (role hierarchy)." }),
        ephemeral: true,
      });
    }

    try {
      await targetMember.timeout(null);

      const modService = new ModerationService(client);
      await modService.logUnmute(interaction.guild!, target, interaction.user);

      await interaction.reply(
        successMessage({
          title: "User Unmuted",
          description: `**${target.tag}** has been unmuted.`,
        })
      );
    } catch (error) {
      await interaction.reply({
        ...errorMessage({ description: "Unable to unmute this user." }),
        ephemeral: true,
      });
    }
  },
} satisfies Command;
