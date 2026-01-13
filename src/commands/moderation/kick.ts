import { SlashCommandBuilder, PermissionFlagsBits, GuildMember } from "discord.js";
import type { Command } from "../../types/index.js";
import { errorMessage, successMessage } from "../../utils/index.js";
import { ModerationService } from "../../services/ModerationService.js";
import { canModerate, botCanModerate } from "../../utils/permissions.js";

export default {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Expulse un utilisateur du serveur")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((opt) =>
      opt.setName("user").setDescription("L'utilisateur à expulser").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("raison").setDescription("Raison de l'expulsion")
    ),

  async execute(interaction, client) {
    const target = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("raison") ?? "Aucune raison fournie";
    const member = interaction.member as GuildMember;
    const targetMember = interaction.guild?.members.cache.get(target.id);

    if (!targetMember) {
      return interaction.reply({
        ...errorMessage({ description: "Cet utilisateur n'est pas sur le serveur." }),
        ephemeral: true,
      });
    }

    if (!canModerate(member, targetMember)) {
      return interaction.reply({
        ...errorMessage({ description: "Tu ne peux pas expulser cet utilisateur (hiérarchie des rôles)." }),
        ephemeral: true,
      });
    }

    if (!botCanModerate(targetMember)) {
      return interaction.reply({
        ...errorMessage({ description: "Je ne peux pas expulser cet utilisateur (hiérarchie des rôles)." }),
        ephemeral: true,
      });
    }

    try {
      await targetMember.kick(`${reason} | Par ${interaction.user.tag}`);

      const modService = new ModerationService(client);
      await modService.logKick(interaction.guild!, target, interaction.user, reason);

      await interaction.reply(
        successMessage({
          title: "Utilisateur expulsé",
          description: `**${target.tag}** a été expulsé.\n**Raison:** ${reason}`,
        })
      );
    } catch (error) {
      await interaction.reply({
        ...errorMessage({ description: "Impossible d'expulser cet utilisateur." }),
        ephemeral: true,
      });
    }
  },
} satisfies Command;
