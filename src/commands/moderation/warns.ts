import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} from "discord.js";
import type { Command } from "../../types/index.js";
import { errorMessage, Colors } from "../../utils/index.js";
import { ModerationService } from "../../services/ModerationService.js";

export default {
  data: new SlashCommandBuilder()
    .setName("warns")
    .setDescription("Voir les avertissements d'un utilisateur")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) =>
      opt.setName("user").setDescription("L'utilisateur").setRequired(true)
    ),

  async execute(interaction, client) {
    const target = interaction.options.getUser("user", true);
    const modService = new ModerationService(client);

    const warns = await modService.getWarns(target.id, interaction.guildId!);

    if (warns.length === 0) {
      return interaction.reply({
        ...errorMessage({
          title: "Aucun avertissement",
          description: `**${target.tag}** n'a aucun avertissement.`,
        }),
        ephemeral: true,
      });
    }

    const container = new ContainerBuilder()
      .setAccentColor(Colors.Warning)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## Avertissements de ${target.tag}`)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**Total:** ${warns.length} warn(s)`)
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      );

    for (const warn of warns.slice(0, 10)) {
      const date = warn.createdAt.toLocaleDateString("fr-FR");
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `**#${warn.id}** - ${date}\n${warn.reason}\n-# Par <@${warn.moderator}>`
        )
      );
    }

    if (warns.length > 10) {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`\n*...et ${warns.length - 10} autres*`)
      );
    }

    await interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
} satisfies Command;
