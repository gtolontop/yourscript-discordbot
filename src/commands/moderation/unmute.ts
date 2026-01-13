import { SlashCommandBuilder, PermissionFlagsBits, GuildMember } from "discord.js";
import type { Command } from "../../types/index.js";
import { errorMessage, successMessage } from "../../utils/index.js";
import { ModerationService } from "../../services/ModerationService.js";
import { canModerate, botCanModerate } from "../../utils/permissions.js";

export default {
  data: new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("Unmute un utilisateur")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) =>
      opt.setName("user").setDescription("L'utilisateur à unmute").setRequired(true)
    ),

  async execute(interaction, client) {
    const target = interaction.options.getUser("user", true);
    const member = interaction.member as GuildMember;
    const targetMember = interaction.guild?.members.cache.get(target.id);

    if (!targetMember) {
      return interaction.reply({
        ...errorMessage({ description: "Cet utilisateur n'est pas sur le serveur." }),
        ephemeral: true,
      });
    }

    if (!targetMember.isCommunicationDisabled()) {
      return interaction.reply({
        ...errorMessage({ description: "Cet utilisateur n'est pas mute." }),
        ephemeral: true,
      });
    }

    if (!canModerate(member, targetMember)) {
      return interaction.reply({
        ...errorMessage({ description: "Tu ne peux pas unmute cet utilisateur (hiérarchie des rôles)." }),
        ephemeral: true,
      });
    }

    if (!botCanModerate(targetMember)) {
      return interaction.reply({
        ...errorMessage({ description: "Je ne peux pas unmute cet utilisateur (hiérarchie des rôles)." }),
        ephemeral: true,
      });
    }

    try {
      await targetMember.timeout(null);

      const modService = new ModerationService(client);
      await modService.logUnmute(interaction.guild!, target, interaction.user);

      await interaction.reply(
        successMessage({
          title: "Utilisateur unmute",
          description: `**${target.tag}** a été unmute.`,
        })
      );
    } catch (error) {
      await interaction.reply({
        ...errorMessage({ description: "Impossible d'unmute cet utilisateur." }),
        ephemeral: true,
      });
    }
  },
} satisfies Command;
