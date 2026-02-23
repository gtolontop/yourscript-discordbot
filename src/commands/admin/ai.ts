import {
  SlashCommandBuilder,
  PermissionFlagsBits,
} from "discord.js";
import type { Command } from "../../types/index.js";
import { createMessage, successMessage, errorMessage } from "../../utils/index.js";

const KB_CATEGORIES = ["business", "glossary", "instructions", "faq", "product"] as const;

export default {
  data: new SlashCommandBuilder()
    .setName("ai")
    .setDescription("Manage the AI system")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("View AI system status")
    )
    .addSubcommand((sub) =>
      sub.setName("toggle").setDescription("Enable or disable AI")
    )
    .addSubcommand((sub) =>
      sub.setName("summary").setDescription("Generate a summary of recent tickets")
    )
    .addSubcommand((sub) =>
      sub
        .setName("embed")
        .setDescription("Generate an embed using AI")
        .addStringOption((opt) =>
          opt.setName("prompt").setDescription("What should the embed look like? e.g. 'rules update red border'").setRequired(true)
        )
        .addChannelOption((opt) =>
          opt.setName("channel").setDescription("Where to post the embed").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("handover")
        .setDescription("Generate a shift handover summary of active open tickets")
    )
    .addSubcommand((sub) =>
      sub
        .setName("staff_report")
        .setDescription("Generate an AI performance report of the staff team for the last 30 days")
    )
    .addSubcommand((sub) =>
      sub
        .setName("memory")
        .setDescription("View AI memories for a user")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("User to view memories for").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("clear-memory")
        .setDescription("Clear AI memories for a user")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("User to clear memories for").setRequired(true)
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName("knowledge")
        .setDescription("Manage AI knowledge base")
        .addSubcommand((sub) =>
          sub
            .setName("add")
            .setDescription("Add knowledge to the AI")
            .addStringOption((opt) =>
              opt
                .setName("category")
                .setDescription("Category of this knowledge")
                .setRequired(true)
                .addChoices(
                  { name: "Business Info", value: "business" },
                  { name: "Glossary / Terms", value: "glossary" },
                  { name: "AI Instructions", value: "instructions" },
                  { name: "FAQ", value: "faq" },
                  { name: "Product / Service", value: "product" },
                )
            )
            .addStringOption((opt) =>
              opt.setName("key").setDescription("Name/identifier (e.g. 'youtube', 'fivem_definition')").setRequired(true)
            )
            .addStringOption((opt) =>
              opt.setName("value").setDescription("The content/info").setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("list")
            .setDescription("List all knowledge entries")
            .addStringOption((opt) =>
              opt
                .setName("category")
                .setDescription("Filter by category")
                .addChoices(
                  { name: "All", value: "all" },
                  { name: "Business Info", value: "business" },
                  { name: "Glossary / Terms", value: "glossary" },
                  { name: "AI Instructions", value: "instructions" },
                  { name: "FAQ", value: "faq" },
                  { name: "Product / Service", value: "product" },
                )
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("remove")
            .setDescription("Remove a knowledge entry")
            .addStringOption((opt) =>
              opt.setName("key").setDescription("Key to remove").setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("edit")
            .setDescription("Edit an existing knowledge entry")
            .addStringOption((opt) =>
              opt.setName("key").setDescription("Key to edit").setRequired(true)
            )
            .addStringOption((opt) =>
              opt.setName("value").setDescription("New content").setRequired(true)
            )
        )
    ),

  async execute(interaction, client) {
    const group = interaction.options.getSubcommandGroup();
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    // Handle knowledge subcommand group
    if (group === "knowledge") {
      return handleKnowledge(interaction, client, sub, guildId);
    }

    switch (sub) {
      case "status": {
        const guildConfig = await client.db.guild.findUnique({ where: { id: guildId } });
        const aiEnabled = guildConfig?.aiEnabled ?? false;

        // Check if AI client is connected
        const aiConnected = client.aiNamespace
          ? (client.aiNamespace.sockets?.size ?? 0) > 0
          : false;

        const openTickets = await client.db.ticket.count({
          where: { guildId, status: "open" },
        });

        const todosOpen = await client.db.todo.count({
          where: { guildId, status: { in: ["open", "in_progress"] } },
        });

        const memoriesCount = await client.db.aIMemory.count({
          where: { guildId },
        });

        const teamCount = await client.db.teamMember.count({
          where: { guildId },
        });

        return interaction.reply(
          createMessage({
            title: "AI System Status",
            description: [
              `**Enabled:** ${aiEnabled ? "Yes" : "No"}`,
              `**AI Client:** ${aiConnected ? "🟢 Connected" : "🔴 Disconnected"}`,
              `**Auto-respond:** ${guildConfig?.aiAutoRespond ? "Yes" : "No"}`,
              `**Response delay:** ${guildConfig?.aiResponseDelay ?? 3}s`,
              "",
              `**Open tickets:** ${openTickets}`,
              `**Open tasks:** ${todosOpen}`,
              `**Memories stored:** ${memoriesCount}`,
              `**Team members:** ${teamCount}`,
              "",
              guildConfig?.aiUrgentChannel ? `**Urgent channel:** <#${guildConfig.aiUrgentChannel}>` : "**Urgent channel:** Not set",
              guildConfig?.aiTodoChannel ? `**Todo channel:** <#${guildConfig.aiTodoChannel}>` : "**Todo channel:** Not set",
            ].join("\n"),
            color: aiEnabled && aiConnected ? "Success" : "Warning",
          })
        );
      }

      case "toggle": {
        const guildConfig = await client.db.guild.findUnique({ where: { id: guildId } });
        const newState = !(guildConfig?.aiEnabled ?? false);

        await client.db.guild.upsert({
          where: { id: guildId },
          update: { aiEnabled: newState },
          create: { id: guildId, aiEnabled: newState },
        });

        return interaction.reply(
          successMessage({
            description: `AI has been **${newState ? "enabled" : "disabled"}**.`,
          })
        );
      }

      case "summary": {
        await interaction.deferReply();

        // Get recent closed tickets
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);

        const recentTickets = await client.db.ticket.findMany({
          where: {
            guildId,
            closedAt: { gte: oneDayAgo },
          },
          orderBy: { closedAt: "desc" },
          take: 20,
        });

        const openTickets = await client.db.ticket.findMany({
          where: { guildId, status: "open" },
        });

        const reviewStats = await client.db.ticket.groupBy({
          by: ["reviewRating"],
          where: { guildId, reviewRating: { not: null } },
          _count: true,
        });

        // Build summary
        const closedCount = recentTickets.length;
        const categories = recentTickets.reduce((acc: Record<string, number>, t) => {
          const cat = t.category ?? "General";
          acc[cat] = (acc[cat] ?? 0) + 1;
          return acc;
        }, {});

        const categoryLines = Object.entries(categories)
          .map(([cat, count]) => `  - ${cat}: **${count}**`)
          .join("\n");

        const avgRating = reviewStats.length > 0
          ? reviewStats.reduce((sum, r) => sum + (r.reviewRating ?? 0) * r._count, 0) /
            reviewStats.reduce((sum, r) => sum + r._count, 0)
          : 0;

        return interaction.editReply(
          createMessage({
            title: "Ticket Summary (Last 24h)",
            description: [
              `**Tickets closed:** ${closedCount}`,
              `**Currently open:** ${openTickets.length}`,
              "",
              categoryLines ? `**By category:**\n${categoryLines}` : "",
              "",
              avgRating > 0 ? `**Average rating:** ${"⭐".repeat(Math.round(avgRating))} (${avgRating.toFixed(1)}/5)` : "",
            ].filter(Boolean).join("\n"),
            color: "Info",
          })
        );
      }

      case "embed": {
        const prompt = interaction.options.getString("prompt", true);
        const targetChannel = interaction.options.getChannel("channel") ?? interaction.channel;
        
        await interaction.deferReply({ ephemeral: true });

        if (!client.aiNamespace || client.aiNamespace.sockets.size === 0) {
            return interaction.editReply(errorMessage({ description: "AI selfbot is not connected. Make sure the backend AI is running." }));
        }

        const aiSocket = Array.from(client.aiNamespace.sockets.values())[0]!;
        const timeout = setTimeout(() => {
            interaction.editReply(errorMessage({ description: "AI request timed out after 15 seconds." }));
        }, 15000);

        aiSocket.emit("query:generateEmbed" as any, { prompt }, async (result: any) => {
            clearTimeout(timeout);
            if (result.error) {
                return interaction.editReply(errorMessage({ description: `AI Failed: ${result.error}` }));
            }
            try {
                const { EmbedBuilder } = await import("discord.js");
                const embedData = result.embed;
                const embed = new EmbedBuilder();
                if (embedData.title) embed.setTitle(embedData.title);
                if (embedData.description) embed.setDescription(embedData.description);
                if (embedData.color) {
                   const c = parseInt(embedData.color.replace("#", ""), 16);
                   if (!isNaN(c)) embed.setColor(c);
                }
                
                if (!targetChannel) {
                   return interaction.editReply(errorMessage({ description: `Could not determine target channel.` }));
                }

                await (targetChannel as any).send({ embeds: [embed] });
                return interaction.editReply(successMessage({ description: `Embed generated and sent to <#${targetChannel.id}>` }));
            } catch (err: any) {
                return interaction.editReply(errorMessage({ description: `Error formatting embed: ${err.message}` }));
            }
        });
        return;
      }

      case "handover": {
        await interaction.deferReply();

        const activeTickets = await client.db.ticket.findMany({
          where: {
            guildId,
            status: "open",
            lastActivity: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) } // Last 12h
          },
        });

        if (activeTickets.length === 0) {
            return interaction.editReply(errorMessage({ description: "There are no active open tickets in the last 12 hours to summarize." }));
        }

        if (!client.aiNamespace || client.aiNamespace.sockets.size === 0) {
            return interaction.editReply(errorMessage({ description: "AI selfbot not connected." }));
        }

        const ticketData = activeTickets.map(t => `Ticket ${t.number} | Subject: ${t.subject ?? 'No subject'} | Priority: ${t.priority} | ClaimedBy: ${t.claimedBy ? `<@${t.claimedBy}>` : 'None'}`).slice(0, 30).join("\\n");
        const aiSocket = Array.from(client.aiNamespace.sockets.values())[0] as any;

        const timeout = setTimeout(() => {
            interaction.editReply(errorMessage({ description: "AI request timed out after 15 seconds." }));
        }, 15000);

        aiSocket.emit("query:generateHandover", { data: ticketData }, async (result: any) => {
            clearTimeout(timeout);
            if (result.error) {
                return interaction.editReply(errorMessage({ description: `AI Failed: ${result.error}` }));
            }
            
            const { EmbedBuilder } = await import("discord.js");
            const embed = new EmbedBuilder()
                .setTitle("📋 Shift Handover Summary")
                .setDescription(result.text)
                .setColor(0x5865f2)
                .setFooter({ text: `Summarized ${activeTickets.length} active tickets from the last 12h`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();
            
            return interaction.editReply({ embeds: [embed] });
        });
        return;
      }

      case "staff_report": {
        await interaction.deferReply({ ephemeral: true });

        const lastMonth = new Date();
        lastMonth.setDate(lastMonth.getDate() - 30);

        const closedTickets = await client.db.ticket.findMany({
          where: {
            guildId,
            status: "closed",
            closedAt: { gte: lastMonth }
          }
        });

        if (closedTickets.length === 0) {
            return interaction.editReply(errorMessage({ description: "No closed tickets found in the last 30 days to analyze." }));
        }

        const ticketIds = closedTickets.map(t => t.id);
        const summaries = await client.db.ticketSummary.findMany({
          where: { ticketId: { in: ticketIds } }
        });
        const summaryMap = new Map(summaries.map(s => [s.ticketId, s]));

        if (!client.aiNamespace || client.aiNamespace.sockets.size === 0) {
            return interaction.editReply(errorMessage({ description: "AI selfbot not connected." }));
        }

        // We map necessary minimal data to prevent token explosion
        const ticketData = closedTickets.map(t => {
            const sum = summaryMap.get(t.id);
            return `ClaimedBy: ${t.claimedBy ? `<@${t.claimedBy}>` : 'Unclaimed'} | Rating: ${t.reviewRating ? t.reviewRating + '/5' : 'None'} | Sentiment: ${sum?.sentiment ?? 'Neutral'}`;
        }).join("\\n");

        const aiSocket = Array.from(client.aiNamespace.sockets.values())[0] as any;

        const timeout = setTimeout(() => {
            interaction.editReply(errorMessage({ description: "AI request timed out after 15 seconds." }));
        }, 15000);

        aiSocket.emit("query:generateStaffReport", { data: ticketData }, async (result: any) => {
            clearTimeout(timeout);
            if (result.error) {
                return interaction.editReply(errorMessage({ description: `AI Failed: ${result.error}` }));
            }
            
            const { EmbedBuilder } = await import("discord.js");
            const embed = new EmbedBuilder()
                .setTitle("📊 AI Monthly Staff Performance Report")
                .setDescription(result.text)
                .setColor(0x5865f2)
                .setFooter({ text: `Analyzed ${closedTickets.length} closed tickets from the last 30 days`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();
            
            return interaction.editReply({ embeds: [embed] });
        });
        return;
      }

      case "memory": {
        const user = interaction.options.getUser("user", true);

        const memories = await client.db.aIMemory.findMany({
          where: { guildId, userId: user.id },
          orderBy: { importance: "desc" },
          take: 10,
        });

        if (memories.length === 0) {
          return interaction.reply(
            createMessage({
              title: `Memories for ${user.username}`,
              description: "No memories stored for this user.",
              color: "Info",
            })
          );
        }

        const typeEmoji: Record<string, string> = {
          preference: "⭐",
          interaction: "💬",
          note: "📝",
          issue: "⚠️",
        };

        const lines = memories.map((m) => {
          const emoji = typeEmoji[m.type] ?? "📄";
          const date = `<t:${Math.floor(m.createdAt.getTime() / 1000)}:R>`;
          return `${emoji} **[${m.type}]** ${m.content} (importance: ${m.importance}/10) — ${date}`;
        });

        return interaction.reply(
          createMessage({
            title: `Memories for ${user.username}`,
            description: lines.join("\n"),
            color: "Info",
            footer: `${memories.length} memory(ies)`,
          })
        );
      }

      case "clear-memory": {
        const user = interaction.options.getUser("user", true);

        const deleted = await client.db.aIMemory.deleteMany({
          where: { guildId, userId: user.id },
        });

        return interaction.reply(
          successMessage({
            description: `Cleared **${deleted.count}** memory(ies) for ${user.toString()}.`,
          })
        );
      }
    }
  },
} satisfies Command;

async function handleKnowledge(
  interaction: any,
  client: any,
  sub: string,
  guildId: string
) {
  const categoryEmoji: Record<string, string> = {
    business: "🏪",
    glossary: "📖",
    instructions: "⚙️",
    faq: "❓",
    product: "🛒",
  };

  switch (sub) {
    case "add": {
      const category = interaction.options.getString("category", true);
      const key = interaction.options.getString("key", true).toLowerCase().replace(/\s+/g, "_");
      const value = interaction.options.getString("value", true);

      try {
        await client.db.aIKnowledge.upsert({
          where: { guildId_key: { guildId, key } },
          update: { value, category, updatedAt: new Date() },
          create: { guildId, category, key, value },
        });

        return interaction.reply(
          successMessage({
            description: `${categoryEmoji[category] ?? "📄"} Added **${key}** to \`${category}\`:\n> ${value.substring(0, 200)}${value.length > 200 ? "..." : ""}`,
          })
        );
      } catch (err) {
        return interaction.reply(
          errorMessage({ description: "Failed to add knowledge entry." })
        );
      }
    }

    case "list": {
      const category = interaction.options.getString("category") ?? "all";
      const where: any = { guildId };
      if (category !== "all") where.category = category;

      const entries = await client.db.aIKnowledge.findMany({
        where,
        orderBy: [{ category: "asc" }, { key: "asc" }],
      });

      if (entries.length === 0) {
        return interaction.reply(
          createMessage({
            title: "AI Knowledge Base",
            description: "No entries yet. Use `/ai knowledge add` to add some!",
            color: "Info",
          })
        );
      }

      // Group by category
      const grouped: Record<string, typeof entries> = {};
      for (const entry of entries) {
        if (!grouped[entry.category]) grouped[entry.category] = [];
        grouped[entry.category]!.push(entry);
      }

      const lines: string[] = [];
      for (const [cat, catEntries] of Object.entries(grouped)) {
        const emoji = categoryEmoji[cat] ?? "📄";
        lines.push(`\n${emoji} **${cat.charAt(0).toUpperCase() + cat.slice(1)}**`);
        for (const entry of catEntries!) {
          const preview = entry.value.substring(0, 80) + (entry.value.length > 80 ? "..." : "");
          lines.push(`  \`${entry.key}\` — ${preview}`);
        }
      }

      return interaction.reply(
        createMessage({
          title: "AI Knowledge Base",
          description: lines.join("\n"),
          color: "Info",
          footer: `${entries.length} entry(ies)`,
        })
      );
    }

    case "remove": {
      const key = interaction.options.getString("key", true).toLowerCase().replace(/\s+/g, "_");

      try {
        const deleted = await client.db.aIKnowledge.delete({
          where: { guildId_key: { guildId, key } },
        });

        return interaction.reply(
          successMessage({
            description: `Removed **${key}** from \`${deleted.category}\`.`,
          })
        );
      } catch {
        return interaction.reply(
          errorMessage({ description: `No entry found with key \`${key}\`.` })
        );
      }
    }

    case "edit": {
      const key = interaction.options.getString("key", true).toLowerCase().replace(/\s+/g, "_");
      const value = interaction.options.getString("value", true);

      try {
        const updated = await client.db.aIKnowledge.update({
          where: { guildId_key: { guildId, key } },
          data: { value, updatedAt: new Date() },
        });

        return interaction.reply(
          successMessage({
            description: `${categoryEmoji[updated.category] ?? "📄"} Updated **${key}**:\n> ${value.substring(0, 200)}${value.length > 200 ? "..." : ""}`,
          })
        );
      } catch {
        return interaction.reply(
          errorMessage({ description: `No entry found with key \`${key}\`.` })
        );
      }
    }
  }
}
