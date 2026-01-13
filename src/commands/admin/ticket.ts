import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { Command } from "../../types/index.js";
import { successMessage, errorMessage, createMessage, warningMessage } from "../../utils/index.js";
import { TicketService } from "../../services/TicketService.js";

export default {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Système de tickets")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Configurer le système de tickets")
        .addChannelOption((opt) =>
          opt
            .setName("category")
            .setDescription("Catégorie pour les tickets")
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName("transcripts")
            .setDescription("Channel pour les transcripts")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName("review")
            .setDescription("Channel pour les reviews staff (accept/refuse)")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName("public_review")
            .setDescription("Channel public pour les avis acceptés")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addRoleOption((opt) =>
          opt
            .setName("support_role")
            .setDescription("Rôle qui peut voir les tickets")
        )
    )
    .addSubcommand((sub) =>
      sub.setName("panel").setDescription("Créer un panel pour les tickets (via modal)")
    )
    .addSubcommand((sub) =>
      sub
        .setName("close")
        .setDescription("Fermer le ticket actuel")
    )
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Ajouter un utilisateur au ticket")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("L'utilisateur à ajouter").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Retirer un utilisateur du ticket")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("L'utilisateur à retirer").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("show").setDescription("Afficher la configuration des tickets")
    )
    .addSubcommand((sub) =>
      sub
        .setName("staffrole")
        .setDescription("Configurer le rôle staff")
        .addRoleOption((opt) =>
          opt.setName("role").setDescription("Le rôle staff").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("rename")
        .setDescription("Renommer le ticket actuel")
        .addStringOption((opt) =>
          opt.setName("name").setDescription("Nouveau nom").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("claim").setDescription("Prendre en charge ce ticket")
    )
    .addSubcommand((sub) =>
      sub.setName("unclaim").setDescription("Libérer ce ticket")
    )
    .addSubcommand((sub) =>
      sub
        .setName("priority")
        .setDescription("Définir la priorité du ticket")
        .addStringOption((opt) =>
          opt
            .setName("level")
            .setDescription("Niveau de priorité")
            .setRequired(true)
            .addChoices(
              { name: "🟢 Basse", value: "low" },
              { name: "🟡 Normale", value: "normal" },
              { name: "🟠 Haute", value: "high" },
              { name: "🔴 Urgente", value: "urgent" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub.setName("info").setDescription("Voir les infos du ticket actuel")
    )
    .addSubcommand((sub) =>
      sub
        .setName("modal")
        .setDescription("Configurer le modal de création de ticket")
        .addStringOption((opt) =>
          opt
            .setName("label")
            .setDescription("Label du champ sujet")
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName("placeholder")
            .setDescription("Placeholder du champ sujet")
            .setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt
            .setName("required")
            .setDescription("Sujet obligatoire ?")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("stats").setDescription("Voir les statistiques des tickets")
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const ticketService = new TicketService(client);

    if (subcommand === "setup") {
      const category = interaction.options.getChannel("category", true);
      const transcripts = interaction.options.getChannel("transcripts", true);
      const review = interaction.options.getChannel("review", true);
      const publicReview = interaction.options.getChannel("public_review", true);
      const supportRole = interaction.options.getRole("support_role");

      await client.db.guild.upsert({
        where: { id: guildId },
        create: {
          id: guildId,
          ticketCategoryId: category.id,
          ticketTranscriptChannel: transcripts.id,
          ticketReviewChannel: review.id,
          ticketPublicReviewChannel: publicReview.id,
          ticketSupportRole: supportRole?.id ?? null,
        },
        update: {
          ticketCategoryId: category.id,
          ticketTranscriptChannel: transcripts.id,
          ticketReviewChannel: review.id,
          ticketPublicReviewChannel: publicReview.id,
          ticketSupportRole: supportRole?.id ?? null,
        },
      });

      await interaction.reply(
        successMessage({
          title: "🎫 Tickets configurés",
          description: [
            `**Catégorie:** ${category.name}`,
            `**Transcripts:** <#${transcripts.id}>`,
            `**Review staff:** <#${review.id}>`,
            `**Avis publics:** <#${publicReview.id}>`,
            supportRole ? `**Rôle support:** ${supportRole.name}` : null,
            "",
            "Utilise `/ticket panel` pour créer un panel de tickets.",
          ].filter(Boolean).join("\n"),
        })
      );
    }

    if (subcommand === "panel") {
      const config = await ticketService.getConfig(guildId);

      if (!config?.ticketCategoryId) {
        return interaction.reply({
          ...errorMessage({ description: "Configure d'abord le système avec `/ticket setup`" }),
          ephemeral: true,
        });
      }

      // Show modal to configure the panel
      const modal = new ModalBuilder()
        .setCustomId("ticket_panel_create")
        .setTitle("Créer un panel de tickets");

      const titleInput = new TextInputBuilder()
        .setCustomId("panel_title")
        .setLabel("Titre du panel")
        .setPlaceholder("Support")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100);

      const descInput = new TextInputBuilder()
        .setCustomId("panel_description")
        .setLabel("Description")
        .setPlaceholder("Clique sur le bouton ci-dessous pour créer un ticket...")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);

      const buttonTextInput = new TextInputBuilder()
        .setCustomId("panel_button_text")
        .setLabel("Texte du bouton")
        .setPlaceholder("Créer un ticket")
        .setValue("Créer un ticket")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(50);

      const buttonEmojiInput = new TextInputBuilder()
        .setCustomId("panel_button_emoji")
        .setLabel("Emoji du bouton (optionnel)")
        .setPlaceholder("🎫")
        .setValue("🎫")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(10);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(descInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(buttonTextInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(buttonEmojiInput)
      );

      await interaction.showModal(modal);
    }

    if (subcommand === "close") {
      const channel = interaction.channel as TextChannel;
      const ticket = await client.db.ticket.findUnique({
        where: { channelId: channel.id },
      });

      if (!ticket) {
        return interaction.reply({
          ...errorMessage({ description: "Ce channel n'est pas un ticket." }),
          ephemeral: true,
        });
      }

      await interaction.reply(
        warningMessage({ description: "Fermeture du ticket en cours..." })
      );

      await ticketService.closeTicket(channel, interaction.user);
    }

    if (subcommand === "add") {
      const channel = interaction.channel as TextChannel;
      const user = interaction.options.getUser("user", true);

      const ticket = await client.db.ticket.findUnique({
        where: { channelId: channel.id },
      });

      if (!ticket) {
        return interaction.reply({
          ...errorMessage({ description: "Ce channel n'est pas un ticket." }),
          ephemeral: true,
        });
      }

      await channel.permissionOverwrites.edit(user.id, {
        ViewChannel: true,
        SendMessages: true,
        AttachFiles: true,
        ReadMessageHistory: true,
      });

      await interaction.reply(
        successMessage({ description: `${user.toString()} a été ajouté au ticket.` })
      );
    }

    if (subcommand === "remove") {
      const channel = interaction.channel as TextChannel;
      const user = interaction.options.getUser("user", true);

      const ticket = await client.db.ticket.findUnique({
        where: { channelId: channel.id },
      });

      if (!ticket) {
        return interaction.reply({
          ...errorMessage({ description: "Ce channel n'est pas un ticket." }),
          ephemeral: true,
        });
      }

      await channel.permissionOverwrites.delete(user.id);

      await interaction.reply(
        successMessage({ description: `${user.toString()} a été retiré du ticket.` })
      );
    }

    if (subcommand === "show") {
      const config = await ticketService.getConfig(guildId);

      if (!config?.ticketCategoryId) {
        return interaction.reply(
          warningMessage({
            description: "Le système de tickets n'est pas configuré.\nUtilise `/ticket setup` pour le configurer.",
          })
        );
      }

      await interaction.reply(
        createMessage({
          title: "🎫 Configuration des tickets",
          description: [
            `**Catégorie:** <#${config.ticketCategoryId}>`,
            `**Transcripts:** ${config.ticketTranscriptChannel ? `<#${config.ticketTranscriptChannel}>` : "Non configuré"}`,
            `**Review staff:** ${config.ticketReviewChannel ? `<#${config.ticketReviewChannel}>` : "Non configuré"}`,
            `**Avis publics:** ${config.ticketPublicReviewChannel ? `<#${config.ticketPublicReviewChannel}>` : "Non configuré"}`,
            `**Rôle support:** ${config.ticketSupportRole ? `<@&${config.ticketSupportRole}>` : "Non configuré"}`,
            `**Tickets créés:** ${config.ticketCounter}`,
          ].join("\n"),
          color: "Primary",
        })
      );
    }

    if (subcommand === "staffrole") {
      const role = interaction.options.getRole("role", true);

      await client.db.guild.upsert({
        where: { id: guildId },
        create: { id: guildId, ticketSupportRole: role.id },
        update: { ticketSupportRole: role.id },
      });

      await interaction.reply(
        successMessage({
          description: `Rôle staff défini sur ${role.toString()}`,
        })
      );
    }

    if (subcommand === "rename") {
      const channel = interaction.channel as TextChannel;
      const newName = interaction.options.getString("name", true);

      const ticket = await client.db.ticket.findUnique({
        where: { channelId: channel.id },
      });

      if (!ticket) {
        return interaction.reply({
          ...errorMessage({ description: "Ce channel n'est pas un ticket." }),
          ephemeral: true,
        });
      }

      await channel.setName(newName);
      await interaction.reply(
        successMessage({ description: `Ticket renommé en **${newName}**` })
      );
    }

    if (subcommand === "claim") {
      const channel = interaction.channel as TextChannel;

      const ticket = await client.db.ticket.findUnique({
        where: { channelId: channel.id },
      });

      if (!ticket) {
        return interaction.reply({
          ...errorMessage({ description: "Ce channel n'est pas un ticket." }),
          ephemeral: true,
        });
      }

      if (ticket.claimedBy) {
        return interaction.reply({
          ...errorMessage({ description: `Ce ticket est déjà pris en charge par <@${ticket.claimedBy}>` }),
          ephemeral: true,
        });
      }

      await client.db.ticket.update({
        where: { id: ticket.id },
        data: { claimedBy: interaction.user.id },
      });

      await channel.setTopic(
        `Ticket de <@${ticket.userId}> | ${ticket.subject ?? "Pas de sujet"} | Pris en charge par ${interaction.user.tag}`
      );

      await interaction.reply(
        successMessage({
          description: `${interaction.user.toString()} prend en charge ce ticket.`,
        })
      );
    }

    if (subcommand === "unclaim") {
      const channel = interaction.channel as TextChannel;

      const ticket = await client.db.ticket.findUnique({
        where: { channelId: channel.id },
      });

      if (!ticket) {
        return interaction.reply({
          ...errorMessage({ description: "Ce channel n'est pas un ticket." }),
          ephemeral: true,
        });
      }

      if (!ticket.claimedBy) {
        return interaction.reply({
          ...errorMessage({ description: "Ce ticket n'est pas pris en charge." }),
          ephemeral: true,
        });
      }

      await client.db.ticket.update({
        where: { id: ticket.id },
        data: { claimedBy: null },
      });

      await channel.setTopic(
        `Ticket de <@${ticket.userId}> | ${ticket.subject ?? "Pas de sujet"}`
      );

      await interaction.reply(
        successMessage({ description: "Ticket libéré." })
      );
    }

    if (subcommand === "priority") {
      const channel = interaction.channel as TextChannel;
      const priority = interaction.options.getString("level", true);

      const ticket = await client.db.ticket.findUnique({
        where: { channelId: channel.id },
      });

      if (!ticket) {
        return interaction.reply({
          ...errorMessage({ description: "Ce channel n'est pas un ticket." }),
          ephemeral: true,
        });
      }

      await client.db.ticket.update({
        where: { id: ticket.id },
        data: { priority },
      });

      const priorityLabels: Record<string, string> = {
        low: "🟢 Basse",
        normal: "🟡 Normale",
        high: "🟠 Haute",
        urgent: "🔴 Urgente",
      };

      // Rename channel with priority prefix for urgent/high
      if (priority === "urgent" || priority === "high") {
        const prefix = priority === "urgent" ? "🔴" : "🟠";
        const baseName = channel.name.replace(/^[🔴🟠🟢🟡]-/, "");
        await channel.setName(`${prefix}-${baseName}`);
      } else {
        // Remove prefix if exists
        const baseName = channel.name.replace(/^[🔴🟠🟢🟡]-/, "");
        await channel.setName(baseName);
      }

      await interaction.reply(
        successMessage({
          description: `Priorité définie sur **${priorityLabels[priority]}**`,
        })
      );
    }

    if (subcommand === "info") {
      const channel = interaction.channel as TextChannel;

      const ticket = await client.db.ticket.findUnique({
        where: { channelId: channel.id },
      });

      if (!ticket) {
        return interaction.reply({
          ...errorMessage({ description: "Ce channel n'est pas un ticket." }),
          ephemeral: true,
        });
      }

      const priorityLabels: Record<string, string> = {
        low: "🟢 Basse",
        normal: "🟡 Normale",
        high: "🟠 Haute",
        urgent: "🔴 Urgente",
      };

      const createdAgo = Math.floor((Date.now() - ticket.createdAt.getTime()) / 1000);
      const hours = Math.floor(createdAgo / 3600);
      const minutes = Math.floor((createdAgo % 3600) / 60);
      const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

      await interaction.reply(
        createMessage({
          title: `🎫 Ticket #${ticket.number.toString().padStart(4, "0")}`,
          description: [
            `**Créé par:** <@${ticket.userId}>`,
            `**Sujet:** ${ticket.subject ?? "Aucun"}`,
            `**Priorité:** ${priorityLabels[ticket.priority] ?? "Normale"}`,
            `**Pris en charge par:** ${ticket.claimedBy ? `<@${ticket.claimedBy}>` : "Personne"}`,
            `**Status:** ${ticket.status}`,
            `**Ouvert depuis:** ${duration}`,
          ].join("\n"),
          color: "Primary",
        })
      );
    }

    if (subcommand === "modal") {
      const label = interaction.options.getString("label");
      const placeholder = interaction.options.getString("placeholder");
      const required = interaction.options.getBoolean("required");

      // Get current config
      const currentConfig = await ticketService.getConfig(guildId);

      const updateData: Record<string, any> = {};
      if (label !== null) updateData.ticketModalLabel = label;
      if (placeholder !== null) updateData.ticketModalPlaceholder = placeholder;
      if (required !== null) updateData.ticketModalRequired = required;

      if (Object.keys(updateData).length === 0) {
        // Show current config
        return interaction.reply(
          createMessage({
            title: "🎫 Configuration du modal",
            description: [
              `**Label:** ${currentConfig?.ticketModalLabel ?? "Sujet (optionnel)"}`,
              `**Placeholder:** ${currentConfig?.ticketModalPlaceholder ?? "Décris brièvement ton problème..."}`,
              `**Obligatoire:** ${currentConfig?.ticketModalRequired ? "Oui" : "Non"}`,
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

      await interaction.reply(
        successMessage({
          description: "Configuration du modal mise à jour !",
        })
      );
    }

    if (subcommand === "stats") {
      const tickets = await client.db.ticket.findMany({
        where: { guildId },
      });

      const totalTickets = tickets.length;
      const openTickets = tickets.filter((t) => t.status === "open").length;
      const closedTickets = tickets.filter((t) => t.status === "closed" || t.status.includes("review")).length;

      // Average response time (time until claimed)
      const claimedTickets = tickets.filter((t) => t.claimedBy);

      // Tickets by category
      const byCategory: Record<string, number> = {};
      tickets.forEach((t) => {
        const cat = t.category ?? "Sans catégorie";
        byCategory[cat] = (byCategory[cat] || 0) + 1;
      });

      // Average rating
      const ratedTickets = tickets.filter((t) => t.reviewRating);
      const avgRating = ratedTickets.length > 0
        ? (ratedTickets.reduce((sum, t) => sum + (t.reviewRating ?? 0), 0) / ratedTickets.length).toFixed(1)
        : "N/A";

      // Tickets today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const ticketsToday = tickets.filter((t) => t.createdAt >= today).length;

      // Tickets this week
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const ticketsWeek = tickets.filter((t) => t.createdAt >= weekAgo).length;

      const categoryLines = Object.entries(byCategory)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, count]) => `• ${cat}: **${count}**`)
        .join("\n");

      await interaction.reply(
        createMessage({
          title: "📊 Statistiques des tickets",
          description: [
            "**Général**",
            `• Total: **${totalTickets}**`,
            `• Ouverts: **${openTickets}**`,
            `• Fermés: **${closedTickets}**`,
            `• Aujourd'hui: **${ticketsToday}**`,
            `• Cette semaine: **${ticketsWeek}**`,
            "",
            "**Avis**",
            `• Note moyenne: **${avgRating}** ⭐`,
            `• Avis reçus: **${ratedTickets.length}**`,
            "",
            "**Par catégorie**",
            categoryLines || "Aucune donnée",
          ].join("\n"),
          color: "Primary",
        })
      );
    }
  },
} satisfies Command;
