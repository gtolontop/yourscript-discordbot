import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, OverwriteType } from "discord.js";
import type { Command } from "../../types/index.js";
import { successMessage, createMessage, errorMessage, warningMessage, logger } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("config")
    .setDescription("Configure the bot for this server")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub.setName("logs").setDescription("Create a complete log category with all channels")
    )
    .addSubcommand((sub) =>
      sub.setName("logs-delete").setDescription("Delete the log category and all its channels")
    )
    .addSubcommand((sub) =>
      sub.setName("show").setDescription("Display current configuration")
    )
    .addSubcommand((sub) =>
      sub.setName("dashboard").setDescription("Get the web dashboard link")
    )
    .addSubcommand((sub) =>
      sub
        .setName("xp")
        .setDescription("Configure the XP system")
        .addIntegerOption((opt) =>
          opt.setName("min").setDescription("Minimum XP per message").setMinValue(1).setMaxValue(100)
        )
        .addIntegerOption((opt) =>
          opt.setName("max").setDescription("Maximum XP per message").setMinValue(1).setMaxValue(100)
        )
        .addIntegerOption((opt) =>
          opt.setName("cooldown").setDescription("Cooldown in seconds").setMinValue(0).setMaxValue(300)
        )
        .addChannelOption((opt) =>
          opt.setName("channel").setDescription("Channel for level up announcements").addChannelTypes(ChannelType.GuildText)
        )
        .addStringOption((opt) =>
          opt.setName("message").setDescription("Level up message ({user}, {level})")
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("tickets")
        .setDescription("Configure the ticket system")
        .addChannelOption((opt) =>
          opt.setName("category").setDescription("Category for tickets").addChannelTypes(ChannelType.GuildCategory)
        )
        .addRoleOption((opt) =>
          opt.setName("support-role").setDescription("Support role")
        )
        .addChannelOption((opt) =>
          opt.setName("transcript").setDescription("Channel for transcripts").addChannelTypes(ChannelType.GuildText)
        )
        .addChannelOption((opt) =>
          opt.setName("review").setDescription("Channel for staff reviews").addChannelTypes(ChannelType.GuildText)
        )
        .addChannelOption((opt) =>
          opt.setName("public-review").setDescription("Channel for public reviews").addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("suggestions")
        .setDescription("Configure the suggestion system")
        .addChannelOption((opt) =>
          opt.setName("channel").setDescription("Channel for suggestions").addChannelTypes(ChannelType.GuildText)
        )
        .addChannelOption((opt) =>
          opt.setName("approved").setDescription("Channel for approved suggestions").addChannelTypes(ChannelType.GuildText)
        )
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const guild = interaction.guild!;

    if (subcommand === "dashboard") {
      const webUrl = process.env['WEB_URL'] ?? `http://localhost:${process.env['WEB_PORT'] ?? 3000}`;
      return interaction.reply(
        createMessage({
          title: "Dashboard",
          description: [
            `Access the web dashboard to configure the bot more easily.`,
            "",
            `**[Open Dashboard](${webUrl}/dashboard/${guildId})**`,
            "",
            `> You must have the **Administrator** or **Manage Messages** permission to access it.`,
          ].join("\n"),
          color: "Primary",
        })
      );
    }

    if (subcommand === "xp") {
      const min = interaction.options.getInteger("min");
      const max = interaction.options.getInteger("max");
      const cooldown = interaction.options.getInteger("cooldown");
      const channel = interaction.options.getChannel("channel");
      const message = interaction.options.getString("message");

      const updateData: any = {};
      if (min !== null) updateData.xpMin = min;
      if (max !== null) updateData.xpMax = max;
      if (cooldown !== null) updateData.xpCooldown = cooldown;
      if (channel) updateData.levelUpChannel = channel.id;
      if (message) updateData.levelUpMessage = message;

      if (Object.keys(updateData).length === 0) {
        const config = await client.db.guild.findUnique({ where: { id: guildId } });
        return interaction.reply(
          createMessage({
            title: "XP Configuration",
            description: [
              `**XP per message:** ${config?.xpMin ?? 15} - ${config?.xpMax ?? 25}`,
              `**Cooldown:** ${config?.xpCooldown ?? 60} seconds`,
              `**Level up channel:** ${config?.levelUpChannel ? `<#${config.levelUpChannel}>` : "Not set"}`,
              `**Message:** ${config?.levelUpMessage ?? "GG {user}, you are now level **{level}**!"}`,
            ].join("\n"),
            color: "Primary",
          })
        );
      }

      await client.db.guild.upsert({
        where: { id: guildId },
        create: { id: guildId, ...updateData },
        update: updateData,
      });

      return interaction.reply(
        successMessage({
          title: "XP Configured",
          description: "XP settings have been updated.",
        })
      );
    }

    if (subcommand === "tickets") {
      const category = interaction.options.getChannel("category");
      const supportRole = interaction.options.getRole("support-role");
      const transcript = interaction.options.getChannel("transcript");
      const review = interaction.options.getChannel("review");
      const publicReview = interaction.options.getChannel("public-review");

      const updateData: any = {};
      if (category) updateData.ticketCategoryId = category.id;
      if (supportRole) updateData.ticketSupportRole = supportRole.id;
      if (transcript) updateData.ticketTranscriptChannel = transcript.id;
      if (review) updateData.ticketReviewChannel = review.id;
      if (publicReview) updateData.ticketPublicReviewChannel = publicReview.id;

      if (Object.keys(updateData).length === 0) {
        const config = await client.db.guild.findUnique({ where: { id: guildId } });
        return interaction.reply(
          createMessage({
            title: "Ticket Configuration",
            description: [
              `**Category:** ${config?.ticketCategoryId ? `<#${config.ticketCategoryId}>` : "Not set"}`,
              `**Support role:** ${config?.ticketSupportRole ? `<@&${config.ticketSupportRole}>` : "Not set"}`,
              `**Transcripts:** ${config?.ticketTranscriptChannel ? `<#${config.ticketTranscriptChannel}>` : "Not set"}`,
              `**Staff review:** ${config?.ticketReviewChannel ? `<#${config.ticketReviewChannel}>` : "Not set"}`,
              `**Public review:** ${config?.ticketPublicReviewChannel ? `<#${config.ticketPublicReviewChannel}>` : "Not set"}`,
            ].join("\n"),
            color: "Primary",
          })
        );
      }

      await client.db.guild.upsert({
        where: { id: guildId },
        create: { id: guildId, ...updateData },
        update: updateData,
      });

      return interaction.reply(
        successMessage({
          title: "Tickets Configured",
          description: "Ticket settings have been updated.",
        })
      );
    }

    if (subcommand === "suggestions") {
      const channel = interaction.options.getChannel("channel");
      const approved = interaction.options.getChannel("approved");

      const updateData: any = {};
      if (channel) updateData.suggestionChannel = channel.id;
      if (approved) updateData.suggestionApprovedChannel = approved.id;

      if (Object.keys(updateData).length === 0) {
        const config = await client.db.guild.findUnique({ where: { id: guildId } });
        return interaction.reply(
          createMessage({
            title: "Suggestion Configuration",
            description: [
              `**Suggestion channel:** ${config?.suggestionChannel ? `<#${config.suggestionChannel}>` : "Not set"}`,
              `**Approved channel:** ${config?.suggestionApprovedChannel ? `<#${config.suggestionApprovedChannel}>` : "Not set"}`,
            ].join("\n"),
            color: "Primary",
          })
        );
      }

      await client.db.guild.upsert({
        where: { id: guildId },
        create: { id: guildId, ...updateData },
        update: updateData,
      });

      return interaction.reply(
        successMessage({
          title: "Suggestions Configured",
          description: "Suggestion settings have been updated.",
        })
      );
    }

    if (subcommand === "logs") {
      await interaction.deferReply();

      const existingConfig = await client.db.guild.findUnique({ where: { id: guildId } });

      try {
        // ── 1. Find or create the log category ────────────────────────────────
        // Priority: DB ID → search by name "Logs" or "logs" in guild → create new
        let category = existingConfig?.logCategoryId
          ? guild.channels.cache.get(existingConfig.logCategoryId) ?? null
          : null;

        if (!category) {
          category =
            guild.channels.cache.find(
              (ch) =>
                ch.type === ChannelType.GuildCategory &&
                ch.name.toLowerCase().includes("log")
            ) ?? null;
        }

        const categoryCreated = !category;
        if (!category) {
          category = await guild.channels.create({
            name: "📁・Logs",
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
              { id: guild.roles.everyone.id, type: OverwriteType.Role, deny: ["ViewChannel"] },
              { id: client.user!.id, type: OverwriteType.Member, allow: ["ViewChannel", "SendMessages", "EmbedLinks"] },
            ],
          });
        } else {
          // Ensure the category has correct permissions
          await (category as any).permissionOverwrites.set([
            { id: guild.roles.everyone.id, type: OverwriteType.Role, deny: ["ViewChannel"] },
            { id: client.user!.id, type: OverwriteType.Member, allow: ["ViewChannel", "SendMessages", "EmbedLinks"] },
          ]).catch(() => {});
        }

        // ── 2. Log channel definitions with slug aliases for smart matching ──
        const logChannels: { name: string; key: string; desc: string; aliases: string[] }[] = [
          { name: "📋・all-logs",       key: "allLogsChannel",       desc: "All logs combined",       aliases: ["all-logs", "all-log"] },
          { name: "🛡️・mod-logs",       key: "modLogsChannel",       desc: "Moderation actions",      aliases: ["mod-logs", "mod-log", "moderation-logs"] },
          { name: "🔨・ban-logs",        key: "banLogsChannel",       desc: "Ban & unban",             aliases: ["ban-logs", "ban-log", "bans"] },
          { name: "💬・message-logs",    key: "msgLogsChannel",       desc: "Message edit & delete",   aliases: ["message-logs", "msg-logs", "messages"] },
          { name: "🔊・voice-logs",      key: "voiceLogsChannel",     desc: "Voice activity",          aliases: ["voice-logs", "voice-log", "vocal-logs"] },
          { name: "📥・join-leave",      key: "joinLeaveLogsChannel", desc: "Member join & leave",     aliases: ["join-leave", "join-leave-logs", "joins"] },
          { name: "👤・member-logs",     key: "memberLogsChannel",    desc: "Roles, nickname, avatar", aliases: ["member-logs", "member-log", "membres"] },
          { name: "💎・boost-logs",      key: "boostLogsChannel",     desc: "Server boosts",           aliases: ["boost-logs", "boost-log", "boosts"] },
          { name: "⚙️・server-logs",     key: "serverLogsChannel",    desc: "Channel & role changes",  aliases: ["server-logs", "server-log", "serveur"] },
          { name: "🔗・invite-logs",     key: "inviteLogsChannel",    desc: "Invite tracking",         aliases: ["invite-logs", "invite-log", "invites"] },
          { name: "🧵・thread-logs",     key: "threadLogsChannel",    desc: "Thread activity",         aliases: ["thread-logs", "thread-log", "threads"] },
          { name: "😀・emoji-logs",      key: "emojiLogsChannel",     desc: "Emoji changes",           aliases: ["emoji-logs", "emoji-log", "emojis"] },
          { name: "🤖・cmd-logs",        key: "cmdLogsChannel",       desc: "Command execution",       aliases: ["cmd-logs", "cmd-log", "commands"] },
          { name: "📊・dashboard-logs",  key: "dashboardLogsChannel", desc: "Dashboard activity",      aliases: ["dashboard-logs", "dashboard-log"] },
        ];

        const updateData: Record<string, string> = { logCategoryId: category.id };
        const createdChannels: string[] = [];
        const renamedChannels: string[] = [];
        const movedChannels: string[] = [];
        const deletedCount: number[] = [];
        const existingChannels: string[] = [];

        // Track which channel IDs have already been assigned (avoid double-assigning)
        const assignedIds = new Set<string>();

        for (const { name, key, desc, aliases } of logChannels) {
          const dbId = (existingConfig as any)?.[key] as string | undefined;

          // ── a. Search all candidates for this slot ─────────────────────────
          // 1) the ID saved in DB (most reliable)
          // 2) any channel whose name matches the target name or one of the aliases
          const candidates = guild.channels.cache.filter((ch) => {
            if (ch.type !== ChannelType.GuildText) return false;
            if (assignedIds.has(ch.id)) return false;
            if (ch.id === dbId) return true;
            const n = ch.name.toLowerCase();
            return aliases.some((a) => n === a || n.includes(a));
          });

          if (candidates.size === 0) {
            // ── d. Create ────────────────────────────────────────────────────
            const newChannel = await guild.channels.create({
              name,
              type: ChannelType.GuildText,
              parent: category.id,
            });
            updateData[key] = newChannel.id;
            assignedIds.add(newChannel.id);
            createdChannels.push(`<#${newChannel.id}> ${desc}`);
            continue;
          }

          // ── b. Pick the best candidate ─────────────────────────────────────
          // Priority: DB ID > in correct category > any other
          let best =
            (dbId && candidates.get(dbId)) ||
            candidates.find((ch) => ch.parentId === category.id) ||
            candidates.first()!;

          // ── c. Delete duplicates (keep best, delete the rest) ──────────────
          const dupes = candidates.filter((ch) => ch.id !== best.id);
          for (const dupe of dupes.values()) {
            await dupe.delete().catch(() => {});
            deletedCount.push(1);
          }

          // ── e. Move to correct category if needed ─────────────────────────
          if (best.parentId !== category.id && "setParent" in best) {
            await (best as any).setParent(category.id, { lockPermissions: false }).catch(() => {});
            movedChannels.push(`<#${best.id}> ${desc}`);
          }

          // ── f. Rename if needed ───────────────────────────────────────────
          if (best.name !== name && "setName" in best) {
            await (best as any).setName(name).catch(() => {});
            if (!movedChannels.some((m) => m.includes(best.id))) {
              renamedChannels.push(`<#${best.id}> ${desc}`);
            }
          } else if (!movedChannels.some((m) => m.includes(best.id))) {
            existingChannels.push(`<#${best.id}> ${desc}`);
          }

          updateData[key] = best.id;
          assignedIds.add(best.id);
        }

        await client.db.guild.upsert({
          where: { id: guildId },
          create: { id: guildId, ...updateData },
          update: updateData,
        });

        // ── 3. Build summary ──────────────────────────────────────────────────
        const lines: string[] = [`**Catégorie :** ${category.name}`, ""];

        if (categoryCreated)      lines.push("✨ **Catégorie créée**", "");
        if (createdChannels.length)   lines.push("✨ **Salons créés :**",   ...createdChannels.map((c) => `> ${c}`), "");
        if (movedChannels.length)     lines.push("📦 **Salons déplacés :**", ...movedChannels.map((c) => `> ${c}`), "");
        if (renamedChannels.length)   lines.push("✏️ **Salons renommés :**", ...renamedChannels.map((c) => `> ${c}`), "");
        if (deletedCount.length)      lines.push(`🗑️ **${deletedCount.length} doublon(s) supprimé(s)**`, "");
        if (existingChannels.length)  lines.push("✅ **Salons déjà en place :**", ...existingChannels.map((c) => `> ${c}`));

        const anyChange = createdChannels.length || movedChannels.length || renamedChannels.length || deletedCount.length || categoryCreated;

        await interaction.editReply(
          successMessage({
            title: anyChange ? "Logs mis à jour" : "Logs déjà configurés",
            description: lines.join("\n").trim(),
          })
        );
      } catch (error) {
        logger.error(`Error /config in ${interaction.guild?.name}:`, error);
        await interaction.editReply(errorMessage({ description: "Impossible de configurer les salons de logs." }));
      }
    }

    if (subcommand === "logs-delete") {
      await interaction.deferReply();

      const config = await client.db.guild.findUnique({ where: { id: guildId } });

      if (!config?.logCategoryId) {
        return interaction.editReply(
          errorMessage({ description: "No log category is configured." })
        );
      }

      try {
        const channelIds = [
          config.allLogsChannel,
          config.modLogsChannel,
          config.banLogsChannel,
          config.msgLogsChannel,
          config.voiceLogsChannel,
          config.joinLeaveLogsChannel,
          config.memberLogsChannel,
          config.boostLogsChannel,
          config.serverLogsChannel,
          config.inviteLogsChannel,
          config.threadLogsChannel,
          config.emojiLogsChannel,
          config.cmdLogsChannel,
          config.dashboardLogsChannel,
        ].filter(Boolean) as string[];

        for (const channelId of channelIds) {
          const channel = guild.channels.cache.get(channelId);
          if (channel) await channel.delete().catch(() => {});
        }

        const category = guild.channels.cache.get(config.logCategoryId);
        if (category) await category.delete().catch(() => {});

        await client.db.guild.update({
          where: { id: guildId },
          data: {
            logCategoryId: null,
            allLogsChannel: null,
            modLogsChannel: null,
            banLogsChannel: null,
            msgLogsChannel: null,
            voiceLogsChannel: null,
            joinLeaveLogsChannel: null,
            memberLogsChannel: null,
            boostLogsChannel: null,
            serverLogsChannel: null,
            inviteLogsChannel: null,
            threadLogsChannel: null,
            emojiLogsChannel: null,
            cmdLogsChannel: null,
            dashboardLogsChannel: null,
          },
        });

        await interaction.editReply(
          successMessage({
            description: "The log category and all its channels have been deleted.",
          })
        );
      } catch (error) {
        logger.error(`Error /config in ${interaction.guild?.name}:`, error);
        await interaction.editReply(
          errorMessage({ description: "Unable to delete log channels." })
        );
      }
    }

    if (subcommand === "show") {
      const config = await client.db.guild.findUnique({ where: { id: guildId } });
      const webUrl = process.env['WEB_URL'] ?? `http://localhost:${process.env['WEB_PORT'] ?? 3000}`;

      const sections = [
        "**Logs**",
        config?.logCategoryId
          ? `✅ Configured (<#${config.allLogsChannel}>)`
          : "❌ Not configured",
        "",
        "**Tickets**",
        config?.ticketCategoryId
          ? `✅ Category: <#${config.ticketCategoryId}>`
          : "❌ Not configured",
        config?.ticketSupportRole ? `Role: <@&${config.ticketSupportRole}>` : "",
        "",
        "**XP**",
        `Min: ${config?.xpMin ?? 15} | Max: ${config?.xpMax ?? 25} | Cooldown: ${config?.xpCooldown ?? 60}s`,
        config?.levelUpChannel ? `Channel: <#${config.levelUpChannel}>` : "",
        "",
        "**Welcome**",
        config?.welcomeChannel ? `✅ <#${config.welcomeChannel}>` : "❌ Not configured",
        "",
        "**Suggestions**",
        config?.suggestionChannel ? `✅ <#${config.suggestionChannel}>` : "❌ Not configured",
        "",
        `**[Dashboard](${webUrl}/dashboard/${guildId})**`,
      ];

      await interaction.reply(
        createMessage({
          title: `Configuration of ${guild.name}`,
          description: sections.filter(Boolean).join("\n"),
          color: "Primary",
        })
      );
    }
  },
} satisfies Command;
