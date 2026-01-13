import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, OverwriteType } from "discord.js";
import type { Command } from "../../types/index.js";
import { successMessage, createMessage, errorMessage, warningMessage } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("config")
    .setDescription("Configure le bot pour ce serveur")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub.setName("logs").setDescription("Créer une catégorie complète de logs avec tous les channels")
    )
    .addSubcommand((sub) =>
      sub.setName("logs-delete").setDescription("Supprimer la catégorie de logs et tous ses channels")
    )
    .addSubcommand((sub) =>
      sub.setName("show").setDescription("Afficher la configuration actuelle")
    )
    .addSubcommand((sub) =>
      sub.setName("dashboard").setDescription("Obtenir le lien vers le dashboard web")
    )
    .addSubcommand((sub) =>
      sub
        .setName("xp")
        .setDescription("Configurer le système de XP")
        .addIntegerOption((opt) =>
          opt.setName("min").setDescription("XP minimum par message").setMinValue(1).setMaxValue(100)
        )
        .addIntegerOption((opt) =>
          opt.setName("max").setDescription("XP maximum par message").setMinValue(1).setMaxValue(100)
        )
        .addIntegerOption((opt) =>
          opt.setName("cooldown").setDescription("Cooldown en secondes").setMinValue(0).setMaxValue(300)
        )
        .addChannelOption((opt) =>
          opt.setName("channel").setDescription("Channel pour les annonces de level up").addChannelTypes(ChannelType.GuildText)
        )
        .addStringOption((opt) =>
          opt.setName("message").setDescription("Message de level up ({user}, {level})")
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("tickets")
        .setDescription("Configurer le système de tickets")
        .addChannelOption((opt) =>
          opt.setName("category").setDescription("Catégorie pour les tickets").addChannelTypes(ChannelType.GuildCategory)
        )
        .addRoleOption((opt) =>
          opt.setName("support-role").setDescription("Rôle du support")
        )
        .addChannelOption((opt) =>
          opt.setName("transcript").setDescription("Channel pour les transcripts").addChannelTypes(ChannelType.GuildText)
        )
        .addChannelOption((opt) =>
          opt.setName("review").setDescription("Channel pour les avis staff").addChannelTypes(ChannelType.GuildText)
        )
        .addChannelOption((opt) =>
          opt.setName("public-review").setDescription("Channel pour les avis publics").addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("suggestions")
        .setDescription("Configurer le système de suggestions")
        .addChannelOption((opt) =>
          opt.setName("channel").setDescription("Channel pour les suggestions").addChannelTypes(ChannelType.GuildText)
        )
        .addChannelOption((opt) =>
          opt.setName("approved").setDescription("Channel pour les suggestions approuvées").addChannelTypes(ChannelType.GuildText)
        )
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const guild = interaction.guild!;

    if (subcommand === "dashboard") {
      const webUrl = process.env.WEB_URL ?? `http://localhost:${process.env.WEB_PORT ?? 3000}`;
      return interaction.reply(
        createMessage({
          title: "Dashboard",
          description: [
            `Accède au dashboard web pour configurer le bot plus facilement.`,
            "",
            `**[Ouvrir le Dashboard](${webUrl}/dashboard/${guildId})**`,
            "",
            `> Tu dois avoir la permission **Administrateur** ou **Gérer les messages** pour y accéder.`,
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
            title: "Configuration XP",
            description: [
              `**XP par message:** ${config?.xpMin ?? 15} - ${config?.xpMax ?? 25}`,
              `**Cooldown:** ${config?.xpCooldown ?? 60} secondes`,
              `**Channel level up:** ${config?.levelUpChannel ? `<#${config.levelUpChannel}>` : "Non défini"}`,
              `**Message:** ${config?.levelUpMessage ?? "GG {user}, tu es maintenant niveau **{level}** !"}`,
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
          title: "XP configuré",
          description: "Les paramètres XP ont été mis à jour.",
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
            title: "Configuration Tickets",
            description: [
              `**Catégorie:** ${config?.ticketCategoryId ? `<#${config.ticketCategoryId}>` : "Non définie"}`,
              `**Rôle support:** ${config?.ticketSupportRole ? `<@&${config.ticketSupportRole}>` : "Non défini"}`,
              `**Transcripts:** ${config?.ticketTranscriptChannel ? `<#${config.ticketTranscriptChannel}>` : "Non défini"}`,
              `**Review staff:** ${config?.ticketReviewChannel ? `<#${config.ticketReviewChannel}>` : "Non défini"}`,
              `**Review public:** ${config?.ticketPublicReviewChannel ? `<#${config.ticketPublicReviewChannel}>` : "Non défini"}`,
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
          title: "Tickets configurés",
          description: "Les paramètres des tickets ont été mis à jour.",
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
            title: "Configuration Suggestions",
            description: [
              `**Channel suggestions:** ${config?.suggestionChannel ? `<#${config.suggestionChannel}>` : "Non défini"}`,
              `**Channel approuvées:** ${config?.suggestionApprovedChannel ? `<#${config.suggestionApprovedChannel}>` : "Non défini"}`,
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
          title: "Suggestions configurées",
          description: "Les paramètres des suggestions ont été mis à jour.",
        })
      );
    }

    if (subcommand === "logs") {
      await interaction.deferReply();

      const existingConfig = await client.db.guild.findUnique({
        where: { id: guildId },
      });

      try {
        // Check if category exists, create if not
        let category = existingConfig?.logCategoryId
          ? guild.channels.cache.get(existingConfig.logCategoryId)
          : null;

        if (!category) {
          category = await guild.channels.create({
            name: "Logs",
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
              {
                id: guild.roles.everyone.id,
                type: OverwriteType.Role,
                deny: ["ViewChannel"],
              },
              {
                id: client.user!.id,
                type: OverwriteType.Member,
                allow: ["ViewChannel", "SendMessages", "EmbedLinks"],
              },
            ],
          });
        }

        // Define all log channels with their config keys
        const logChannels = [
          { name: "all-logs", key: "allLogsChannel", desc: "Tous les logs" },
          { name: "mod-logs", key: "modLogsChannel", desc: "Modération" },
          { name: "message-logs", key: "msgLogsChannel", desc: "Messages" },
          { name: "voice-logs", key: "voiceLogsChannel", desc: "Vocal" },
          { name: "member-logs", key: "memberLogsChannel", desc: "Membres" },
          { name: "server-logs", key: "serverLogsChannel", desc: "Serveur" },
          { name: "dashboard-logs", key: "dashboardLogsChannel", desc: "Dashboard" },
        ];

        const updateData: Record<string, string> = { logCategoryId: category.id };
        const createdChannels: string[] = [];
        const existingChannels: string[] = [];

        for (const { name, key, desc } of logChannels) {
          const existingId = (existingConfig as any)?.[key];
          const existingChannel = existingId ? guild.channels.cache.get(existingId) : null;

          if (existingChannel) {
            updateData[key] = existingChannel.id;
            existingChannels.push(`<#${existingChannel.id}> - ${desc}`);
          } else {
            const newChannel = await guild.channels.create({
              name,
              type: ChannelType.GuildText,
              parent: category.id,
            });
            updateData[key] = newChannel.id;
            createdChannels.push(`<#${newChannel.id}> - ${desc} ✨`);
          }
        }

        await client.db.guild.upsert({
          where: { id: guildId },
          create: { id: guildId, ...updateData },
          update: updateData,
        });

        const description = [
          `**Catégorie:** ${category.name}`,
          "",
        ];

        if (createdChannels.length > 0) {
          description.push("**Channels créés:**");
          description.push(...createdChannels);
        }

        if (existingChannels.length > 0) {
          if (createdChannels.length > 0) description.push("");
          description.push("**Channels existants:**");
          description.push(...existingChannels);
        }

        await interaction.editReply(
          successMessage({
            title: createdChannels.length > 0 ? "Logs mis à jour" : "Logs déjà configurés",
            description: description.join("\n"),
          })
        );
      } catch (error) {
        console.error(error);
        await interaction.editReply(
          errorMessage({ description: "Impossible de créer les channels de logs." })
        );
      }
    }

    if (subcommand === "logs-delete") {
      await interaction.deferReply();

      const config = await client.db.guild.findUnique({ where: { id: guildId } });

      if (!config?.logCategoryId) {
        return interaction.editReply(
          errorMessage({ description: "Aucune catégorie de logs n'est configurée." })
        );
      }

      try {
        const channelIds = [
          config.allLogsChannel,
          config.modLogsChannel,
          config.msgLogsChannel,
          config.voiceLogsChannel,
          config.memberLogsChannel,
          config.serverLogsChannel,
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
            msgLogsChannel: null,
            voiceLogsChannel: null,
            memberLogsChannel: null,
            serverLogsChannel: null,
            dashboardLogsChannel: null,
          },
        });

        await interaction.editReply(
          successMessage({
            description: "La catégorie de logs et tous ses channels ont été supprimés.",
          })
        );
      } catch (error) {
        console.error(error);
        await interaction.editReply(
          errorMessage({ description: "Impossible de supprimer les channels de logs." })
        );
      }
    }

    if (subcommand === "show") {
      const config = await client.db.guild.findUnique({ where: { id: guildId } });
      const webUrl = process.env.WEB_URL ?? `http://localhost:${process.env.WEB_PORT ?? 3000}`;

      const sections = [
        "**Logs**",
        config?.logCategoryId
          ? `✅ Configurés (<#${config.allLogsChannel}>)`
          : "❌ Non configurés",
        "",
        "**Tickets**",
        config?.ticketCategoryId
          ? `✅ Catégorie: <#${config.ticketCategoryId}>`
          : "❌ Non configurés",
        config?.ticketSupportRole ? `Rôle: <@&${config.ticketSupportRole}>` : "",
        "",
        "**XP**",
        `Min: ${config?.xpMin ?? 15} | Max: ${config?.xpMax ?? 25} | Cooldown: ${config?.xpCooldown ?? 60}s`,
        config?.levelUpChannel ? `Channel: <#${config.levelUpChannel}>` : "",
        "",
        "**Welcome**",
        config?.welcomeChannel ? `✅ <#${config.welcomeChannel}>` : "❌ Non configuré",
        "",
        "**Suggestions**",
        config?.suggestionChannel ? `✅ <#${config.suggestionChannel}>` : "❌ Non configuré",
        "",
        `**[Dashboard](${webUrl}/dashboard/${guildId})**`,
      ];

      await interaction.reply(
        createMessage({
          title: `Configuration de ${guild.name}`,
          description: sections.filter(Boolean).join("\n"),
          color: "Primary",
        })
      );
    }
  },
} satisfies Command;
