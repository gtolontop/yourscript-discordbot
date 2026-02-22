import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  GuildMember,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} from "discord.js";
import type { Command } from "../../types/index.js";
import {
  errorMessage,
  successMessage,
  warningMessage,
  Colors,
  canModerate,
} from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Manage user warnings")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Warn a user")
        .addUserOption((opt) =>
          opt
            .setName("user")
            .setDescription("The user to warn")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("reason")
            .setDescription("Reason for the warning")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a specific warning")
        .addIntegerOption((opt) =>
          opt
            .setName("warn-id")
            .setDescription("The ID of the warning to remove")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("List all warnings for a user")
        .addUserOption((opt) =>
          opt
            .setName("user")
            .setDescription("The user to view warnings for")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("clear")
        .setDescription("Clear all warnings for a user")
        .addUserOption((opt) =>
          opt
            .setName("user")
            .setDescription("The user to clear warnings for")
            .setRequired(true),
        ),
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "add":
        return handleAdd(interaction, client);
      case "remove":
        return handleRemove(interaction, client);
      case "list":
        return handleList(interaction, client);
      case "clear":
        return handleClear(interaction, client);
    }
  },
} satisfies Command;

async function handleAdd(
  interaction: import("discord.js").ChatInputCommandInteraction,
  client: import("../../client/Bot.js").Bot,
) {
  const target = interaction.options.getUser("user", true);
  const reason = interaction.options.getString("reason", true);
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

  if (!canModerate(member, targetMember)) {
    return interaction.reply({
      ...errorMessage({
        description:
          "You cannot warn this user (role hierarchy).",
      }),
      ephemeral: true,
    });
  }

  try {
    await client.api.addWarn({
      guildId: interaction.guildId!,
      targetUserId: target.id,
      moderatorId: interaction.user.id,
      reason,
    });

    const warns = await client.api.getWarns(
      interaction.guildId!,
      target.id,
    );
    const warnCount = warns.length;

    // Try to DM the user
    try {
      await target.send(
        `You have received a warning on **${interaction.guild?.name}**\n**Reason:** ${reason}`,
      );
    } catch {
      // DMs disabled, ignore
    }

    await interaction.reply(
      warningMessage({
        title: "Warning Issued",
        description: `**${target.tag}** has been warned.\n**Reason:** ${reason}\n**Total warnings:** ${warnCount}`,
      }),
    );
  } catch (error) {
    console.error("Warn add error:", error);
    await interaction.reply({
      ...errorMessage({
        description: "Failed to add warning.",
      }),
      ephemeral: true,
    });
  }
}

async function handleRemove(
  interaction: import("discord.js").ChatInputCommandInteraction,
  client: import("../../client/Bot.js").Bot,
) {
  const warnId = interaction.options.getInteger("warn-id", true);

  try {
    await client.api.deleteWarn(interaction.guildId!, warnId);

    await interaction.reply(
      successMessage({
        title: "Warning Removed",
        description: `Warning **#${warnId}** has been removed.`,
      }),
    );
  } catch (error) {
    console.error("Warn remove error:", error);
    await interaction.reply({
      ...errorMessage({
        description: `Failed to remove warning **#${warnId}**. It may not exist.`,
      }),
      ephemeral: true,
    });
  }
}

async function handleList(
  interaction: import("discord.js").ChatInputCommandInteraction,
  client: import("../../client/Bot.js").Bot,
) {
  const target = interaction.options.getUser("user", true);

  try {
    const warns = await client.api.getWarns(
      interaction.guildId!,
      target.id,
    );

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
        new TextDisplayBuilder().setContent(
          `## Warnings for ${target.tag}`,
        ),
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `**Total:** ${warns.length} warning(s)`,
        ),
      )
      .addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(SeparatorSpacingSize.Small)
          .setDivider(true),
      );

    for (const warn of warns.slice(0, 10)) {
      const date = new Date(warn.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `**#${warn.id}** - ${date}\n${warn.reason}\n-# By <@${warn.moderator_id}>`,
        ),
      );
    }

    if (warns.length > 10) {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `\n*...and ${warns.length - 10} more*`,
        ),
      );
    }

    await interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  } catch (error) {
    console.error("Warn list error:", error);
    await interaction.reply({
      ...errorMessage({
        description: "Failed to fetch warnings.",
      }),
      ephemeral: true,
    });
  }
}

async function handleClear(
  interaction: import("discord.js").ChatInputCommandInteraction,
  client: import("../../client/Bot.js").Bot,
) {
  const target = interaction.options.getUser("user", true);

  try {
    const warns = await client.api.getWarns(
      interaction.guildId!,
      target.id,
    );

    if (warns.length === 0) {
      return interaction.reply({
        ...errorMessage({
          description: `**${target.tag}** has no warnings to clear.`,
        }),
        ephemeral: true,
      });
    }

    await client.api.clearWarns(interaction.guildId!, target.id);

    await interaction.reply(
      successMessage({
        title: "Warnings Cleared",
        description: `All warnings for **${target.tag}** have been cleared (**${warns.length}** removed).`,
      }),
    );
  } catch (error) {
    console.error("Warn clear error:", error);
    await interaction.reply({
      ...errorMessage({
        description: "Failed to clear warnings.",
      }),
      ephemeral: true,
    });
  }
}
