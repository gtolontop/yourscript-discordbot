import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  Role,
  TextChannel,
} from "discord.js";
import type { Command } from "../../types/index.js";
import { errorMessage, successMessage, createMessage, warningMessage } from "../../utils/index.js";
import type { Bot } from "../../client/Bot.js";

export default {
  data: new SlashCommandBuilder()
    .setName("roleall")
    .setDescription("Ajoute ou retire un rôle à tous les membres")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Ajoute un rôle à tous les membres")
        .addRoleOption((opt) =>
          opt.setName("role").setDescription("Le rôle à ajouter").setRequired(true)
        )
        .addBooleanOption((opt) =>
          opt.setName("bots").setDescription("Inclure les bots (défaut: non)")
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Retire un rôle de tous les membres")
        .addRoleOption((opt) =>
          opt.setName("role").setDescription("Le rôle à retirer").setRequired(true)
        )
        .addBooleanOption((opt) =>
          opt.setName("bots").setDescription("Inclure les bots (défaut: non)")
        )
    )
    .addSubcommand((sub) =>
      sub.setName("resume").setDescription("Reprendre un job interrompu")
    )
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("Voir les jobs en cours/pausés")
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild!;

    if (subcommand === "status") {
      const jobs = await client.db.roleAllJob.findMany({
        where: {
          guildId: guild.id,
          status: { in: ["running", "paused"] },
        },
      });

      if (jobs.length === 0) {
        return interaction.reply(
          warningMessage({ description: "Aucun job en cours ou en pause." })
        );
      }

      const lines = jobs.map((job) => {
        const processed = JSON.parse(job.processedIds).length;
        const total = JSON.parse(job.memberIds).length;
        const percent = Math.round((processed / total) * 100);
        return `**#${job.id}** - ${job.action} <@&${job.roleId}> - ${percent}% (${job.status})`;
      });

      return interaction.reply(
        createMessage({
          title: "📋 Jobs roleall",
          description: lines.join("\n"),
          color: "Primary",
        })
      );
    }

    if (subcommand === "resume") {
      // Find paused job
      const pausedJob = await client.db.roleAllJob.findFirst({
        where: {
          guildId: guild.id,
          status: "paused",
        },
        orderBy: { createdAt: "desc" },
      });

      if (!pausedJob) {
        return interaction.reply({
          ...errorMessage({ description: "Aucun job en pause à reprendre." }),
          ephemeral: true,
        });
      }

      await interaction.deferReply();

      // Resume the job
      await resumeRoleAllJob(client, pausedJob.id, interaction.channel as TextChannel);

      return;
    }

    // Add or remove
    const role = interaction.options.getRole("role", true) as Role;
    const includeBots = interaction.options.getBoolean("bots") ?? false;
    const action = subcommand as "add" | "remove";

    // Check if bot can manage this role
    const botMember = guild.members.me;
    if (!botMember) {
      return interaction.reply({
        ...errorMessage({ description: "Impossible de récupérer mes informations." }),
        ephemeral: true,
      });
    }

    if (role.position >= botMember.roles.highest.position) {
      return interaction.reply({
        ...errorMessage({ description: "Ce rôle est plus haut que mon rôle le plus élevé." }),
        ephemeral: true,
      });
    }

    if (role.managed) {
      return interaction.reply({
        ...errorMessage({ description: "Ce rôle est géré par une intégration et ne peut pas être modifié." }),
        ephemeral: true,
      });
    }

    // Check for existing running job
    const existingJob = await client.db.roleAllJob.findFirst({
      where: {
        guildId: guild.id,
        status: "running",
      },
    });

    if (existingJob) {
      return interaction.reply({
        ...errorMessage({ description: "Un job est déjà en cours. Attends qu'il se termine ou utilise `/roleall status`." }),
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    // Fetch all members
    await guild.members.fetch();

    // Filter members
    let members = guild.members.cache.filter((m) => !m.user.bot || includeBots);

    if (action === "add") {
      members = members.filter((m) => !m.roles.cache.has(role.id));
    } else {
      members = members.filter((m) => m.roles.cache.has(role.id));
    }

    const memberIds = Array.from(members.keys());

    if (memberIds.length === 0) {
      const msg = action === "add"
        ? "Tous les membres ont déjà ce rôle."
        : "Aucun membre n'a ce rôle.";
      return interaction.editReply(warningMessage({ description: msg }));
    }

    // Create job in DB
    const job = await client.db.roleAllJob.create({
      data: {
        guildId: guild.id,
        roleId: role.id,
        action,
        includeBots,
        memberIds: JSON.stringify(memberIds),
        processedIds: "[]",
        channelId: interaction.channelId,
        status: "running",
      },
    });

    // Send initial message
    const reply = await interaction.editReply(
      createMessage({
        title: action === "add" ? "➕ Ajout du rôle en cours..." : "➖ Retrait du rôle en cours...",
        description: [
          `**Rôle:** ${role.name}`,
          `**Job ID:** #${job.id}`,
          "",
          `░░░░░░░░░░ 0%`,
          "",
          `✅ Succès: 0`,
          `❌ Échecs: 0`,
          `📊 Total: 0/${memberIds.length}`,
          "",
          `-# Si interrompu, utilise \`/roleall resume\` pour reprendre`,
        ].join("\n"),
        color: "Primary",
      })
    );

    // Update job with message ID
    await client.db.roleAllJob.update({
      where: { id: job.id },
      data: { messageId: reply.id },
    });

    // Process the job
    await processRoleAllJob(client, job.id);
  },
} satisfies Command;

/**
 * Process a roleall job
 */
export async function processRoleAllJob(client: Bot, jobId: number): Promise<void> {
  const job = await client.db.roleAllJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "running") return;

  const guild = client.guilds.cache.get(job.guildId);
  if (!guild) return;

  const role = guild.roles.cache.get(job.roleId);
  if (!role) return;

  const channel = job.channelId ? guild.channels.cache.get(job.channelId) as TextChannel : null;

  const memberIds: string[] = JSON.parse(job.memberIds);
  const processedIds: string[] = JSON.parse(job.processedIds);
  let success = job.success;
  let failed = job.failed;

  // Get remaining members
  const remainingIds = memberIds.filter((id) => !processedIds.includes(id));

  const updateProgress = async () => {
    const processed = processedIds.length;
    const total = memberIds.length;
    const percent = Math.round((processed / total) * 100);
    const bar = createProgressBar(percent);

    // Update DB
    await client.db.roleAllJob.update({
      where: { id: jobId },
      data: {
        processedIds: JSON.stringify(processedIds),
        success,
        failed,
      },
    });

    // Update message if we have channel and message
    if (channel && job.messageId) {
      try {
        const message = await channel.messages.fetch(job.messageId);
        await message.edit(
          createMessage({
            title: job.action === "add" ? "➕ Ajout du rôle en cours..." : "➖ Retrait du rôle en cours...",
            description: [
              `**Rôle:** ${role.name}`,
              `**Job ID:** #${job.id}`,
              "",
              `${bar} ${percent}%`,
              "",
              `✅ Succès: ${success}`,
              `❌ Échecs: ${failed}`,
              `📊 Total: ${processed}/${total}`,
              "",
              `-# Si interrompu, utilise \`/roleall resume\` pour reprendre`,
            ].join("\n"),
            color: "Primary",
          })
        );
      } catch {}
    }
  };

  // Process in batches
  const batchSize = 10;

  for (let i = 0; i < remainingIds.length; i += batchSize) {
    // Check if job was cancelled
    const currentJob = await client.db.roleAllJob.findUnique({ where: { id: jobId } });
    if (!currentJob || currentJob.status !== "running") {
      // Job was paused or cancelled
      return;
    }

    const batch = remainingIds.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (memberId) => {
        try {
          const member = await guild.members.fetch(memberId).catch(() => null);
          if (member) {
            if (job.action === "add") {
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
        processedIds.push(memberId);
      })
    );

    await updateProgress();

    // Small delay to avoid rate limits
    if (i + batchSize < remainingIds.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // Mark as completed
  await client.db.roleAllJob.update({
    where: { id: jobId },
    data: {
      status: "completed",
      processedIds: JSON.stringify(processedIds),
      success,
      failed,
    },
  });

  // Final message
  if (channel && job.messageId) {
    try {
      const message = await channel.messages.fetch(job.messageId);
      await message.edit(
        successMessage({
          title: job.action === "add" ? "➕ Rôle ajouté" : "➖ Rôle retiré",
          description: [
            `**Rôle:** ${role.name}`,
            `**Job ID:** #${job.id}`,
            "",
            `✅ **${success}** membres ${job.action === "add" ? "ont reçu" : "ont perdu"} le rôle`,
            failed > 0 ? `❌ **${failed}** échecs` : null,
          ].filter(Boolean).join("\n"),
        })
      );
    } catch {}
  }
}

/**
 * Resume a paused job
 */
export async function resumeRoleAllJob(client: Bot, jobId: number, channel?: TextChannel): Promise<void> {
  // Update status to running
  const job = await client.db.roleAllJob.update({
    where: { id: jobId },
    data: {
      status: "running",
      channelId: channel?.id ?? undefined,
    },
  });

  if (channel) {
    const role = client.guilds.cache.get(job.guildId)?.roles.cache.get(job.roleId);
    const processed = JSON.parse(job.processedIds).length;
    const total = JSON.parse(job.memberIds).length;
    const remaining = total - processed;

    const reply = await channel.send(
      createMessage({
        title: "🔄 Reprise du job...",
        description: [
          `**Rôle:** ${role?.name ?? "Inconnu"}`,
          `**Job ID:** #${job.id}`,
          `**Restant:** ${remaining} membres`,
        ].join("\n"),
        color: "Primary",
      })
    );

    await client.db.roleAllJob.update({
      where: { id: jobId },
      data: { messageId: reply.id },
    });
  }

  await processRoleAllJob(client, jobId);
}

function createProgressBar(percent: number): string {
  const filled = Math.round(percent / 10);
  const empty = 10 - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}
