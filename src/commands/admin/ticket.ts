import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
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
    .setDescription("Ticket system")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Configure the ticket system")
        .addChannelOption((opt) =>
          opt
            .setName("category")
            .setDescription("Category for tickets")
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName("transcripts")
            .setDescription("Channel for transcripts")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName("review")
            .setDescription("Channel for staff reviews (accept/refuse)")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName("public_review")
            .setDescription("Public channel for accepted reviews")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addRoleOption((opt) =>
          opt
            .setName("support_role")
            .setDescription("Role that can view tickets")
        )
    )
    .addSubcommand((sub) =>
      sub.setName("panel").setDescription("Create a ticket panel with dropdown categories")
    )
    .addSubcommand((sub) =>
      sub
        .setName("close")
        .setDescription("Close the current ticket")
    )
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a user to the ticket")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("The user to add").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a user from the ticket")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("The user to remove").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("show").setDescription("Display ticket configuration")
    )
    .addSubcommand((sub) =>
      sub
        .setName("staffrole")
        .setDescription("Configure the staff role")
        .addRoleOption((opt) =>
          opt.setName("role").setDescription("The staff role").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("rename")
        .setDescription("Rename the current ticket")
        .addStringOption((opt) =>
          opt.setName("name").setDescription("New name").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("claim").setDescription("Claim this ticket")
    )
    .addSubcommand((sub) =>
      sub.setName("unclaim").setDescription("Unclaim this ticket")
    )
    .addSubcommand((sub) =>
      sub
        .setName("priority")
        .setDescription("Set ticket priority")
        .addStringOption((opt) =>
          opt
            .setName("level")
            .setDescription("Priority level")
            .setRequired(true)
            .addChoices(
              { name: "🟢 Low", value: "low" },
              { name: "🟡 Normal", value: "normal" },
              { name: "🟠 High", value: "high" },
              { name: "🔴 Urgent", value: "urgent" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub.setName("info").setDescription("View current ticket info")
    )
    .addSubcommand((sub) =>
      sub
        .setName("modal")
        .setDescription("Configure the ticket creation modal")
        .addStringOption((opt) =>
          opt
            .setName("label")
            .setDescription("Subject field label")
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName("placeholder")
            .setDescription("Subject field placeholder")
            .setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt
            .setName("required")
            .setDescription("Subject required?")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("stats").setDescription("View ticket statistics")
    )
    .addSubcommand((sub) =>
      sub.setName("summary").setDescription("Generate an AI summary of the current ticket")
    )
    .addSubcommand((sub) =>
      sub.setName("context").setDescription("View AI context and sentiment for the current ticket")
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
          title: "🎫 Tickets Configured",
          description: [
            `**Category:** ${category.name}`,
            `**Transcripts:** <#${transcripts.id}>`,
            `**Staff review:** <#${review.id}>`,
            `**Public reviews:** <#${publicReview.id}>`,
            supportRole ? `**Support role:** ${supportRole.name}` : null,
            "",
            "Use `/ticket panel` to create a ticket panel.",
          ].filter(Boolean).join("\n"),
        })
      );
    }

    if (subcommand === "panel") {
      const config = await ticketService.getConfig(guildId);

      if (!config?.ticketCategoryId) {
        return interaction.reply({
          ...errorMessage({ description: "Configure the system first with `/ticket setup`" }),
          ephemeral: true,
        });
      }

      // Check categories exist — panel requires at least one
      const categories = await client.db.ticketCategory.findMany({
        where: { guildId },
      });

      if (categories.length === 0) {
        return interaction.reply({
          ...errorMessage({
            description:
              "You need at least one ticket category to create a panel.\nUse `/ticketcategory add` to create categories first.",
          }),
          ephemeral: true,
        });
      }

      // Show modal to configure the panel (title + description only)
      const modal = new ModalBuilder()
        .setCustomId("ticket_panel_create")
        .setTitle("Create a ticket panel");

      const titleInput = new TextInputBuilder()
        .setCustomId("panel_title")
        .setLabel("Panel title")
        .setPlaceholder("Support")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100);

      const descInput = new TextInputBuilder()
        .setCustomId("panel_description")
        .setLabel("Description")
        .setPlaceholder("Select a category below to open a ticket...")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(descInput)
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
          ...errorMessage({ description: "This channel is not a ticket." }),
          ephemeral: true,
        });
      }

      await interaction.reply(
        warningMessage({ description: "Closing ticket..." })
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
          ...errorMessage({ description: "This channel is not a ticket." }),
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
        successMessage({ description: `${user.toString()} has been added to the ticket.` })
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
          ...errorMessage({ description: "This channel is not a ticket." }),
          ephemeral: true,
        });
      }

      await channel.permissionOverwrites.delete(user.id);

      await interaction.reply(
        successMessage({ description: `${user.toString()} has been removed from the ticket.` })
      );
    }

    if (subcommand === "show") {
      const config = await ticketService.getConfig(guildId);

      if (!config?.ticketCategoryId) {
        return interaction.reply(
          warningMessage({
            description: "The ticket system is not configured.\nUse `/ticket setup` to configure it.",
          })
        );
      }

      await interaction.reply(
        createMessage({
          title: "🎫 Ticket Configuration",
          description: [
            `**Category:** <#${config.ticketCategoryId}>`,
            `**Transcripts:** ${config.ticketTranscriptChannel ? `<#${config.ticketTranscriptChannel}>` : "Not configured"}`,
            `**Staff review:** ${config.ticketReviewChannel ? `<#${config.ticketReviewChannel}>` : "Not configured"}`,
            `**Public reviews:** ${config.ticketPublicReviewChannel ? `<#${config.ticketPublicReviewChannel}>` : "Not configured"}`,
            `**Support role:** ${config.ticketSupportRole ? `<@&${config.ticketSupportRole}>` : "Not configured"}`,
            `**Tickets created:** ${config.ticketCounter}`,
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
          description: `Staff role set to ${role.toString()}`,
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
          ...errorMessage({ description: "This channel is not a ticket." }),
          ephemeral: true,
        });
      }

      await channel.setName(newName);
      await interaction.reply(
        successMessage({ description: `Ticket renamed to **${newName}**` })
      );
    }

    if (subcommand === "claim") {
      const channel = interaction.channel as TextChannel;

      const ticket = await client.db.ticket.findUnique({
        where: { channelId: channel.id },
      });

      if (!ticket) {
        return interaction.reply({
          ...errorMessage({ description: "This channel is not a ticket." }),
          ephemeral: true,
        });
      }

      if (ticket.claimedBy) {
        return interaction.reply({
          ...errorMessage({ description: `This ticket is already claimed by <@${ticket.claimedBy}>` }),
          ephemeral: true,
        });
      }

      await client.db.ticket.update({
        where: { id: ticket.id },
        data: { claimedBy: interaction.user.id },
      });

      await channel.setTopic(
        `Ticket by <@${ticket.userId}> | ${ticket.subject ?? "No subject"} | Claimed by ${interaction.user.tag}`
      );

      await interaction.reply(
        successMessage({
          description: `${interaction.user.toString()} has claimed this ticket.`,
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
          ...errorMessage({ description: "This channel is not a ticket." }),
          ephemeral: true,
        });
      }

      if (!ticket.claimedBy) {
        return interaction.reply({
          ...errorMessage({ description: "This ticket is not claimed." }),
          ephemeral: true,
        });
      }

      await client.db.ticket.update({
        where: { id: ticket.id },
        data: { claimedBy: null },
      });

      await channel.setTopic(
        `Ticket by <@${ticket.userId}> | ${ticket.subject ?? "No subject"}`
      );

      await interaction.reply(
        successMessage({ description: "Ticket unclaimed." })
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
          ...errorMessage({ description: "This channel is not a ticket." }),
          ephemeral: true,
        });
      }

      await client.db.ticket.update({
        where: { id: ticket.id },
        data: { priority },
      });

      const priorityLabels: Record<string, string> = {
        low: "🟢 Low",
        normal: "🟡 Normal",
        high: "🟠 High",
        urgent: "🔴 Urgent",
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
          description: `Priority set to **${priorityLabels[priority]}**`,
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
          ...errorMessage({ description: "This channel is not a ticket." }),
          ephemeral: true,
        });
      }

      const priorityLabels: Record<string, string> = {
        low: "🟢 Low",
        normal: "🟡 Normal",
        high: "🟠 High",
        urgent: "🔴 Urgent",
      };

      const createdAgo = Math.floor((Date.now() - ticket.createdAt.getTime()) / 1000);
      const hours = Math.floor(createdAgo / 3600);
      const minutes = Math.floor((createdAgo % 3600) / 60);
      const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

      await interaction.reply(
        createMessage({
          title: `🎫 Ticket #${ticket.number.toString().padStart(4, "0")}`,
          description: [
            `**Created by:** <@${ticket.userId}>`,
            `**Subject:** ${ticket.subject ?? "None"}`,
            `**Priority:** ${priorityLabels[ticket.priority] ?? "Normal"}`,
            `**Claimed by:** ${ticket.claimedBy ? `<@${ticket.claimedBy}>` : "Nobody"}`,
            `**Status:** ${ticket.status}`,
            `**Open for:** ${duration}`,
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
      if (label !== null) updateData['ticketModalLabel'] = label;
      if (placeholder !== null) updateData['ticketModalPlaceholder'] = placeholder;
      if (required !== null) updateData['ticketModalRequired'] = required;

      if (Object.keys(updateData).length === 0) {
        // Show current config
        return interaction.reply(
          createMessage({
            title: "🎫 Modal Configuration",
            description: [
              `**Label:** ${currentConfig?.ticketModalLabel ?? "Subject (optional)"}`,
              `**Placeholder:** ${currentConfig?.ticketModalPlaceholder ?? "Briefly describe your issue..."}`,
              `**Required:** ${currentConfig?.ticketModalRequired ? "Yes" : "No"}`,
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
          description: "Modal configuration updated!",
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
        const cat = t.category ?? "Uncategorized";
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
          title: "📊 Ticket Statistics",
          description: [
            "**General**",
            `• Total: **${totalTickets}**`,
            `• Open: **${openTickets}**`,
            `• Closed: **${closedTickets}**`,
            `• Today: **${ticketsToday}**`,
            `• This week: **${ticketsWeek}**`,
            "",
            "**Reviews**",
            `• Average rating: **${avgRating}** ⭐`,
            `• Reviews received: **${ratedTickets.length}**`,
            "",
            "**By category**",
            categoryLines || "No data",
          ].join("\n"),
          color: "Primary",
        })
      );
    }

    if (subcommand === "summary") {
      const channel = interaction.channel as TextChannel;
      const ticket = await client.db.ticket.findUnique({
        where: { channelId: channel.id },
      });

      if (!ticket) {
        return interaction.reply({
          ...errorMessage({ description: "This channel is not a ticket." }),
          ephemeral: true,
        });
      }

      if (!client.aiNamespace) {
        return interaction.reply({
          ...errorMessage({ description: "AI system is not connected." }),
          ephemeral: true,
        });
      }

      await interaction.deferReply();

      // Fetch recent messages from channel
      const messages = await channel.messages.fetch({ limit: 100 });
      const sortedMessages = [...messages.values()].reverse();
      const conversationMessages = sortedMessages
        .filter((m) => m.content && !m.author.bot)
        .map((m) => ({
          role: m.author.id === ticket.userId ? "user" : "staff",
          content: m.content,
        }));

      // Include bot/AI messages too
      const allMessages = sortedMessages
        .filter((m) => m.content)
        .map((m) => ({
          role: m.author.id === ticket.userId ? "user" : m.author.bot ? "ai" : "staff",
          content: m.content,
        }));

      // Get existing summary
      const existingSummary = await client.db.ticketSummary.findUnique({
        where: { ticketId: ticket.id },
      });

      // Request summary from AI
      const aiSockets = await client.aiNamespace.fetchSockets();
      if (aiSockets.length === 0) {
        return interaction.editReply(
          errorMessage({ description: "AI client is offline." })
        );
      }

      try {
        const result = await new Promise<any>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("Timeout")), 30000);
          aiSockets[0]!.emit("query:generateSummary" as any, {
            channelId: channel.id,
            guildId: guildId,
            ticketId: ticket.id,
            messages: allMessages,
            previousSummary: existingSummary?.summary ?? null,
          }, (res: any) => {
            clearTimeout(timeout);
            resolve(res);
          });
        });

        // Store the summary
        await client.db.ticketSummary.upsert({
          where: { ticketId: ticket.id },
          create: {
            ticketId: ticket.id,
            channelId: channel.id,
            guildId: guildId,
            summary: result.summary,
            keyPoints: JSON.stringify(result.keyPoints ?? []),
            sentiment: result.sentiment ?? "neutral",
            trend: result.trend ?? "stable",
            suggestions: JSON.stringify(result.suggestions ?? []),
            messageCount: allMessages.length,
          },
          update: {
            summary: result.summary,
            keyPoints: JSON.stringify(result.keyPoints ?? []),
            sentiment: result.sentiment ?? "neutral",
            trend: result.trend ?? "stable",
            suggestions: JSON.stringify(result.suggestions ?? []),
            messageCount: allMessages.length,
          },
        });

        const sentimentEmoji: Record<string, string> = {
          positive: "😊",
          neutral: "😐",
          negative: "😟",
          frustrated: "😤",
        };

        const trendEmoji: Record<string, string> = {
          improving: "📈",
          stable: "➡️",
          declining: "📉",
        };

        const keyPoints = (result.keyPoints ?? []) as string[];
        const suggestions = (result.suggestions ?? []) as string[];

        await interaction.editReply(
          createMessage({
            title: `📋 Ticket #${ticket.number.toString().padStart(4, "0")} — Summary`,
            description: [
              `**Summary**`,
              result.summary,
              "",
              keyPoints.length > 0 ? `**Key Points**\n${keyPoints.map((p: string) => `• ${p}`).join("\n")}` : null,
              "",
              `**Mood:** ${sentimentEmoji[result.sentiment] ?? "😐"} ${result.sentiment} ${trendEmoji[result.trend] ?? "➡️"} ${result.trend}`,
              "",
              suggestions.length > 0 ? `**Suggestions**\n${suggestions.map((s: string) => `💡 ${s}`).join("\n")}` : null,
              "",
              `-# ${allMessages.length} messages analyzed`,
            ].filter(Boolean).join("\n"),
            color: "Primary",
          })
        );
      } catch (err) {
        await interaction.editReply(
          errorMessage({ description: "Failed to generate summary. Is the AI client connected?" })
        );
      }
    }

    if (subcommand === "context") {
      const channel = interaction.channel as TextChannel;
      const ticket = await client.db.ticket.findUnique({
        where: { channelId: channel.id },
      });

      if (!ticket) {
        return interaction.reply({
          ...errorMessage({ description: "This channel is not a ticket." }),
          ephemeral: true,
        });
      }

      // Get existing summary from DB
      const summary = await client.db.ticketSummary.findUnique({
        where: { ticketId: ticket.id },
      });

      // Get message count in channel
      const messages = await channel.messages.fetch({ limit: 100 });
      const totalMessages = messages.size;

      const sentimentEmoji: Record<string, string> = {
        positive: "😊",
        neutral: "😐",
        negative: "😟",
        frustrated: "😤",
      };

      const trendEmoji: Record<string, string> = {
        improving: "📈",
        stable: "➡️",
        declining: "📉",
      };

      const priorityLabels: Record<string, string> = {
        low: "🟢 Low",
        normal: "🟡 Normal",
        high: "🟠 High",
        urgent: "🔴 Urgent",
      };

      const createdAgo = Math.floor((Date.now() - ticket.createdAt.getTime()) / 1000);
      const hours = Math.floor(createdAgo / 3600);
      const minutes = Math.floor((createdAgo % 3600) / 60);
      const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

      let summarySection = "No summary yet. Run `/ticket summary` to generate one.";
      let suggestionsSection = "";

      if (summary) {
        summarySection = summary.summary;
        const keyPoints = JSON.parse(summary.keyPoints) as string[];
        const suggestions = JSON.parse(summary.suggestions) as string[];

        if (keyPoints.length > 0) {
          summarySection += `\n\n**Key Points:**\n${keyPoints.map((p) => `• ${p}`).join("\n")}`;
        }
        if (suggestions.length > 0) {
          suggestionsSection = `\n\n**Suggestions:**\n${suggestions.map((s) => `💡 ${s}`).join("\n")}`;
        }
      }

      await interaction.reply(
        createMessage({
          title: `🧠 Ticket #${ticket.number.toString().padStart(4, "0")} — Context`,
          description: [
            `**Status:** ${ticket.status} | **Priority:** ${priorityLabels[ticket.priority] ?? "Normal"}`,
            `**Created by:** <@${ticket.userId}> | **Open for:** ${duration}`,
            `**Claimed by:** ${ticket.claimedBy ? `<@${ticket.claimedBy}>` : "Nobody"}`,
            `**Messages:** ${totalMessages}`,
            "",
            `**AI Summary:**`,
            summarySection,
            summary ? `\n**Mood:** ${sentimentEmoji[summary.sentiment] ?? "😐"} ${summary.sentiment} ${trendEmoji[summary.trend] ?? "➡️"} ${summary.trend}` : "",
            suggestionsSection,
            "",
            summary ? `-# Last updated: <t:${Math.floor(summary.updatedAt.getTime() / 1000)}:R> (${summary.messageCount} msgs)` : "",
          ].filter(Boolean).join("\n"),
          color: "Primary",
        })
      );
    }
  },
} satisfies Command;
