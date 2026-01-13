import { SlashCommandBuilder, PermissionFlagsBits, GuildMember } from "discord.js";
import type { Command } from "../../types/index.js";
import { errorMessage, successMessage, warningMessage } from "../../utils/index.js";
import { ModerationService } from "../../services/ModerationService.js";
import { canModerate } from "../../utils/permissions.js";

export default {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Avertit un utilisateur")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) =>
      opt.setName("user").setDescription("L'utilisateur à avertir").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("raison").setDescription("Raison de l'avertissement").setRequired(true)
    ),

  async execute(interaction, client) {
    const target = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("raison", true);
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
        ...errorMessage({ description: "Tu ne peux pas avertir cet utilisateur (hiérarchie des rôles)." }),
        ephemeral: true,
      });
    }

    const modService = new ModerationService(client);

    // Add warn to DB
    await modService.addWarn(target.id, interaction.guildId!, interaction.user.id, reason);
    const warnCount = await modService.getWarnCount(target.id, interaction.guildId!);

    // Send log
    await modService.logWarn(interaction.guild!, target, interaction.user, reason, warnCount);

    // Try to DM the user
    try {
      await target.send(
        `⚠️ Tu as reçu un avertissement sur **${interaction.guild?.name}**\n**Raison:** ${reason}`
      );
    } catch {
      // DMs disabled
    }

    await interaction.reply(
      warningMessage({
        title: "Avertissement",
        description: `**${target.tag}** a reçu un avertissement.\n**Raison:** ${reason}\n**Total warns:** ${warnCount}`,
      })
    );
  },
} satisfies Command;
