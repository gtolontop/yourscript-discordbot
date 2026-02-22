import { SlashCommandBuilder, PermissionFlagsBits, GuildMember } from "discord.js";
import type { Command } from "../../types/index.js";
import { errorMessage, successMessage } from "../../utils/index.js";
import { ModerationService } from "../../services/ModerationService.js";
import { canModerate, botCanModerate } from "../../utils/permissions.js";

export default {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a user from the server")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((opt) =>
      opt.setName("user").setDescription("The user to kick").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("raison").setDescription("Reason for the kick")
    ),

  async execute(interaction, client) {
    const target = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("raison") ?? "No reason provided";
    const member = interaction.member as GuildMember;
    const targetMember = interaction.guild?.members.cache.get(target.id);

    if (!targetMember) {
      return interaction.reply({
        ...errorMessage({ description: "This user is not on the server." }),
        ephemeral: true,
      });
    }

    if (!canModerate(member, targetMember)) {
      return interaction.reply({
        ...errorMessage({ description: "You cannot kick this user (role hierarchy)." }),
        ephemeral: true,
      });
    }

    if (!botCanModerate(targetMember)) {
      return interaction.reply({
        ...errorMessage({ description: "I cannot kick this user (role hierarchy)." }),
        ephemeral: true,
      });
    }

    try {
      await targetMember.kick(`${reason} | By ${interaction.user.tag}`);

      const modService = new ModerationService(client);
      await modService.logKick(interaction.guild!, target, interaction.user, reason);

      await interaction.reply(
        successMessage({
          title: "User Kicked",
          description: `**${target.tag}** has been kicked.\n**Reason:** ${reason}`,
        })
      );
    } catch (error) {
      await interaction.reply({
        ...errorMessage({ description: "Unable to kick this user." }),
        ephemeral: true,
      });
    }
  },
} satisfies Command;
