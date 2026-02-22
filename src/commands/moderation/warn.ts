import { SlashCommandBuilder, PermissionFlagsBits, GuildMember } from "discord.js";
import type { Command } from "../../types/index.js";
import { errorMessage, successMessage, warningMessage } from "../../utils/index.js";
import { ModerationService } from "../../services/ModerationService.js";
import { canModerate } from "../../utils/permissions.js";

export default {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a user")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) =>
      opt.setName("user").setDescription("The user to warn").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("raison").setDescription("Reason for the warning").setRequired(true)
    ),

  async execute(interaction, client) {
    const target = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("raison", true);
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
        ...errorMessage({ description: "You cannot warn this user (role hierarchy)." }),
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
        `⚠️ You have received a warning on **${interaction.guild?.name}**\n**Reason:** ${reason}`
      );
    } catch {
      // DMs disabled
    }

    await interaction.reply(
      warningMessage({
        title: "Warning",
        description: `**${target.tag}** has received a warning.\n**Reason:** ${reason}\n**Total warns:** ${warnCount}`,
      })
    );
  },
} satisfies Command;
