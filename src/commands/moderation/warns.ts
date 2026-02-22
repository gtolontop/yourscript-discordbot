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
    .setDescription("View a user's warnings")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) =>
      opt.setName("user").setDescription("The user").setRequired(true)
    ),

  async execute(interaction, client) {
    const target = interaction.options.getUser("user", true);
    const modService = new ModerationService(client);

    const warns = await modService.getWarns(target.id, interaction.guildId!);

    if (warns.length === 0) {
      return interaction.reply({
        ...errorMessage({
          title: "No Warnings",
          description: `**${target.tag}** has no warnings.`,
        }),
        ephemeral: true,
      });
    }

    const container = new ContainerBuilder()
      .setAccentColor(Colors.Warning)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## Warnings for ${target.tag}`)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**Total:** ${warns.length} warning(s)`)
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      );

    for (const warn of warns.slice(0, 10)) {
      const date = warn.createdAt.toLocaleDateString("en-US");
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `**#${warn.id}** - ${date}\n${warn.reason}\n-# Par <@${warn.odByModId}>`
        )
      );
    }

    if (warns.length > 10) {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`\n*...and ${warns.length - 10} more*`)
      );
    }

    await interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
} satisfies Command;
