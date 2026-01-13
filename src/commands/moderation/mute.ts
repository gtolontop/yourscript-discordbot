import { SlashCommandBuilder, PermissionFlagsBits, GuildMember } from "discord.js";
import type { Command } from "../../types/index.js";
import { errorMessage, successMessage } from "../../utils/index.js";
import { ModerationService } from "../../services/ModerationService.js";
import { canModerate, botCanModerate } from "../../utils/permissions.js";

const durations: Record<string, number> = {
  "1m": 60 * 1000,
  "5m": 5 * 60 * 1000,
  "10m": 10 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "28d": 28 * 24 * 60 * 60 * 1000,
};

export default {
  data: new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Mute un utilisateur (timeout)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) =>
      opt.setName("user").setDescription("L'utilisateur à mute").setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("duree")
        .setDescription("Durée du mute")
        .setRequired(true)
        .addChoices(
          { name: "1 minute", value: "1m" },
          { name: "5 minutes", value: "5m" },
          { name: "10 minutes", value: "10m" },
          { name: "30 minutes", value: "30m" },
          { name: "1 heure", value: "1h" },
          { name: "6 heures", value: "6h" },
          { name: "12 heures", value: "12h" },
          { name: "1 jour", value: "1d" },
          { name: "7 jours", value: "7d" },
          { name: "28 jours", value: "28d" }
        )
    )
    .addStringOption((opt) =>
      opt.setName("raison").setDescription("Raison du mute")
    ),

  async execute(interaction, client) {
    const target = interaction.options.getUser("user", true);
    const duration = interaction.options.getString("duree", true);
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
        ...errorMessage({ description: "Tu ne peux pas mute cet utilisateur (hiérarchie des rôles)." }),
        ephemeral: true,
      });
    }

    if (!botCanModerate(targetMember)) {
      return interaction.reply({
        ...errorMessage({ description: "Je ne peux pas mute cet utilisateur (hiérarchie des rôles)." }),
        ephemeral: true,
      });
    }

    const durationMs = durations[duration];
    if (!durationMs) {
      return interaction.reply({
        ...errorMessage({ description: "Durée invalide." }),
        ephemeral: true,
      });
    }

    try {
      await targetMember.timeout(durationMs, `${reason} | Par ${interaction.user.tag}`);

      const modService = new ModerationService(client);
      await modService.logMute(interaction.guild!, target, interaction.user, duration, reason);

      await interaction.reply(
        successMessage({
          title: "Utilisateur mute",
          description: `**${target.tag}** a été mute pour **${duration}**.\n**Raison:** ${reason}`,
        })
      );
    } catch (error) {
      await interaction.reply({
        ...errorMessage({ description: "Impossible de mute cet utilisateur." }),
        ephemeral: true,
      });
    }
  },
} satisfies Command;
