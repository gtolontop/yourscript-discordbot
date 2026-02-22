import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  Role,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../types/index.js";
import type { Bot } from "../../client/Bot.js";
import {
  successMessage,
  errorMessage,
  createMessage,
  warningMessage,
} from "../../utils/index.js";

const data = new SlashCommandBuilder()
  .setName("role-all")
  .setDescription("Add or remove a role from all members")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addRoleOption((opt) =>
    opt.setName("role").setDescription("The role to add or remove").setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName("action")
      .setDescription("Whether to add or remove the role")
      .setRequired(true)
      .addChoices(
        { name: "Add", value: "add" },
        { name: "Remove", value: "remove" }
      )
  )
  .addBooleanOption((opt) =>
    opt
      .setName("include-bots")
      .setDescription("Include bots (default: no)")
  );

async function execute(
  interaction: ChatInputCommandInteraction,
  client: Bot
): Promise<unknown> {
  const role = interaction.options.getRole("role", true) as Role;
  const action = interaction.options.getString("action", true) as "add" | "remove";
  const includeBots = interaction.options.getBoolean("include-bots") ?? false;
  const guild = interaction.guild!;

  // Check if bot can manage this role
  const botMember = guild.members.me;
  if (!botMember) {
    return interaction.reply({
      ...errorMessage({ description: "Unable to retrieve my own member data." }),
      ephemeral: true,
    });
  }

  if (role.position >= botMember.roles.highest.position) {
    return interaction.reply({
      ...errorMessage({
        description: "This role is higher than my highest role. I cannot manage it.",
      }),
      ephemeral: true,
    });
  }

  if (role.managed) {
    return interaction.reply({
      ...errorMessage({
        description: "This role is managed by an integration and cannot be modified.",
      }),
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  // Fetch all members
  await guild.members.fetch();

  // Filter members based on action
  let members = guild.members.cache.filter(
    (m) => !m.user.bot || includeBots
  );

  if (action === "add") {
    members = members.filter((m) => !m.roles.cache.has(role.id));
  } else {
    members = members.filter((m) => m.roles.cache.has(role.id));
  }

  const memberIds = Array.from(members.keys());

  if (memberIds.length === 0) {
    const msg =
      action === "add"
        ? "All members already have this role."
        : "No members have this role.";
    return interaction.editReply(warningMessage({ description: msg }));
  }

  // Send initial progress message
  await interaction.editReply(
    createMessage({
      title: action === "add" ? "Adding role..." : "Removing role...",
      description: [
        `**Role:** ${role.name}`,
        `**Members to process:** ${memberIds.length}`,
        "",
        `${createProgressBar(0)} 0%`,
        "",
        `Successes: 0`,
        `Failures: 0`,
        `Progress: 0/${memberIds.length}`,
      ].join("\n"),
      color: "Primary",
    })
  );

  // Process in batches
  let success = 0;
  let failed = 0;
  const batchSize = 10;

  for (let i = 0; i < memberIds.length; i += batchSize) {
    const batch = memberIds.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (memberId) => {
        try {
          const member = await guild.members.fetch(memberId).catch(() => null);
          if (member) {
            if (action === "add") {
              await member.roles.add(role);
            } else {
              await member.roles.remove(role);
            }
            success++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      })
    );

    // Update progress
    const processed = Math.min(i + batchSize, memberIds.length);
    const percent = Math.round((processed / memberIds.length) * 100);

    try {
      await interaction.editReply(
        createMessage({
          title: action === "add" ? "Adding role..." : "Removing role...",
          description: [
            `**Role:** ${role.name}`,
            `**Members to process:** ${memberIds.length}`,
            "",
            `${createProgressBar(percent)} ${percent}%`,
            "",
            `Successes: ${success}`,
            `Failures: ${failed}`,
            `Progress: ${processed}/${memberIds.length}`,
          ].join("\n"),
          color: "Primary",
        })
      );
    } catch {
      // Message edit may fail if interaction expired
    }

    // Small delay to avoid rate limits
    if (i + batchSize < memberIds.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // Final message
  return interaction.editReply(
    successMessage({
      title: action === "add" ? "Role Added" : "Role Removed",
      description: [
        `**Role:** ${role.name}`,
        "",
        `**${success}** member(s) ${action === "add" ? "received" : "lost"} the role.`,
        failed > 0 ? `**${failed}** failure(s)` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    })
  );
}

function createProgressBar(percent: number): string {
  const filled = Math.round(percent / 10);
  const empty = 10 - filled;
  return "\u2588".repeat(filled) + "\u2591".repeat(empty);
}

export default { data, execute } satisfies Command;
