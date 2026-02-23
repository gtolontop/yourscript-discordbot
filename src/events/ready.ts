import { ActivityType, ChannelType, OAuth2Scopes, PermissionFlagsBits, REST, Routes } from "discord.js";
import { joinVoiceChannel } from "@discordjs/voice";
import type { Event } from "../types/index.js";
import { logger } from "../utils/index.js";
import { processRoleAllJob } from "../commands/admin/roleall.js";
import { TicketService } from "../services/TicketService.js";
import { startGiveawayScheduler } from "../commands/admin/giveaway.js";
import { startWebServer } from "../web/server.js";
import { ReminderService } from "../services/ReminderService.js";

const event: Event<"clientReady"> = {
  name: "clientReady",
  once: true,
  async execute(client) {
    logger.info(`Logged in as ${client.user?.tag}`);
    logger.info(`Serving ${client.guilds.cache.size} guilds`);

    // Auto-deploy slash commands (globally only)
    try {
      const commands = client.commands.map((cmd) => cmd.data.toJSON());
      const rest = new REST().setToken(client.token!);

      // Deploy globally
      await rest.put(Routes.applicationCommands(client.user!.id), {
        body: commands,
      });

      // Clear guild-specific commands to avoid duplicates
      const guildId = process.env["GUILD_ID"];
      if (guildId) {
        await rest.put(Routes.applicationGuildCommands(client.user!.id, guildId), {
          body: [],
        });
      }

      logger.info(`Deployed ${commands.length} slash commands globally`);
    } catch (error) {
      logger.error("Failed to deploy commands:", error);
    }

    // Auto-reconnect to 24/7 voice channels
    try {
      const sessions = await client.db.voiceSession.findMany({
        where: { is247: true },
      });

      for (const session of sessions) {
        const guild = client.guilds.cache.get(session.id);
        if (!guild) continue;

        const channel = guild.channels.cache.get(session.channelId);
        if (!channel || (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice)) {
          // Channel doesn't exist anymore, remove session
          await client.db.voiceSession.delete({ where: { id: session.id } }).catch(() => {});
          continue;
        }

        joinVoiceChannel({
          channelId: channel.id,
          guildId: guild.id,
          adapterCreator: guild.voiceAdapterCreator,
          selfDeaf: true,
        });

        logger.info(`Reconnected to 24/7 channel: ${channel.name} (${guild.name})`);
      }

      if (sessions.length > 0) {
        logger.info(`Reconnected to ${sessions.length} 24/7 voice channels`);
      }
    } catch (error) {
      logger.error("Failed to reconnect to 24/7 channels:", error);
    }

    // Auto-resume roleall jobs that were running or paused
    try {
      const jobs = await client.db.roleAllJob.findMany({
        where: {
          status: { in: ["running", "paused"] },
        },
      });

      for (const job of jobs) {
        const guild = client.guilds.cache.get(job.guildId);
        if (!guild) {
          // Guild not found, mark as failed
          await client.db.roleAllJob.update({
            where: { id: job.id },
            data: { status: "completed" },
          });
          continue;
        }

        // Set status to running before resuming
        await client.db.roleAllJob.update({
          where: { id: job.id },
          data: { status: "running" },
        });

        const processed = JSON.parse(job.processedIds).length;
        const total = JSON.parse(job.memberIds).length;
        const remaining = total - processed;

        logger.info(`Resuming roleall job #${job.id} in ${guild.name} (${remaining} remaining)`);

        // Resume in background (don't await)
        processRoleAllJob(client, job.id).catch((error) => {
          logger.error(`Failed to resume roleall job #${job.id}:`, error);
        });
      }

      if (jobs.length > 0) {
        logger.info(`Resumed ${jobs.length} roleall jobs`);
      }
    } catch (error) {
      logger.error("Failed to resume roleall jobs:", error);
    }

    // Show invite link if no guilds
    if (client.guilds.cache.size === 0) {
      const invite = client.generateInvite({
        scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
        permissions: [
          PermissionFlagsBits.Administrator,
        ],
      });
      logger.info(`Invite me: ${invite}`);
    }

    // Load saved status from database
    try {
      const botConfig = await client.db.botConfig.findUnique({
        where: { id: "bot" },
      });

      if (botConfig?.statusType && botConfig?.statusText) {
        const activityTypes: Record<string, ActivityType> = {
          playing: ActivityType.Playing,
          watching: ActivityType.Watching,
          listening: ActivityType.Listening,
          competing: ActivityType.Competing,
          streaming: ActivityType.Streaming,
        };

        const activityType = activityTypes[botConfig.statusType];

        if (activityType !== undefined) {
          if (botConfig.statusType === "streaming" && botConfig.statusUrl) {
            client.user?.setActivity({
              name: botConfig.statusText,
              type: activityType,
              url: botConfig.statusUrl,
            });
          } else {
            client.user?.setActivity({
              name: botConfig.statusText,
              type: activityType,
            });
          }
        }
        logger.info(`Restored status: ${botConfig.statusType} - ${botConfig.statusText}`);
      } else {
        // Default status
        client.user?.setActivity({
          name: "your server",
          type: ActivityType.Watching,
        });
      }
    } catch (error) {
      logger.error("Failed to restore status:", error);
      // Fallback to default
      client.user?.setActivity({
        name: "ton serveur",
        type: ActivityType.Watching,
      });
    }

    // Start ticket auto-close scheduler
    const ticketService = new TicketService(client);
    ticketService.startAutoCloseScheduler();
    logger.info("Ticket auto-close scheduler started");

    // Start giveaway scheduler
    await startGiveawayScheduler(client);
    logger.info("Giveaway scheduler started");

    // Start web server for transcripts
    const webPort = parseInt(process.env['WEB_PORT'] ?? "3000");
    const { aiNamespace } = startWebServer(client, webPort);
    client.aiNamespace = aiNamespace;

    // Start reminder service
    const reminderService = new ReminderService(client);
    reminderService.start();

    // Start daily todo summary scheduler (09:00 Paris time)
    startDailySummaryScheduler(client);
  },
};

function startDailySummaryScheduler(client: any) {
  // Check every minute if it's 09:00 Paris time
  let lastRunDate = "";

  setInterval(async () => {
    const now = new Date();
    const parisTime = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now);

    const today = now.toISOString().split("T")[0]!;

    if (parisTime === "09:00" && lastRunDate !== today) {
      lastRunDate = today;
      logger.info("Running daily todo summary...");

      try {
        // Get all guilds with AI enabled and a todo channel
        const guilds = await client.db.guild.findMany({
          where: { aiEnabled: true, aiTodoChannel: { not: null } },
        });

        for (const guildConfig of guilds) {
          const todos = await client.db.todo.findMany({
            where: { guildId: guildConfig.id, status: { in: ["open", "in_progress"] } },
            orderBy: { priority: "desc" },
          });

          if (todos.length === 0) continue;

          const channel = client.channels.cache.get(guildConfig.aiTodoChannel);
          if (!channel?.isTextBased() || channel.isDMBased()) continue;

          const priorityEmoji: Record<string, string> = {
            urgent: "🔴",
            high: "🟠",
            normal: "🟡",
            low: "🟢",
          };

          const todoLines = todos.map((t: any) => {
            const emoji = priorityEmoji[t.priority] ?? "🟡";
            const assignee = t.assigneeId ? `<@${t.assigneeId}>` : "Unassigned";
            const status = t.status === "in_progress" ? "🔄" : "📋";
            return `${status} ${emoji} **${t.title}** — ${assignee}`;
          });

          const { EmbedBuilder } = await import("discord.js");
          const embed = new EmbedBuilder()
            .setTitle("📋 Daily Task Summary")
            .setDescription(todoLines.join("\n"))
            .setColor(0x5865f2)
            .setFooter({ text: `${todos.length} open task(s)` })
            .setTimestamp();

         await (channel as any).send({ embeds: [embed] }).catch(() => {});

          // AI Sentiment Daily Report
          try {
             const yesterday = new Date();
             yesterday.setDate(yesterday.getDate() - 1);
             const closedTickets = await client.db.ticket.findMany({
                 where: { guildId: guildConfig.id, closedAt: { gte: yesterday } },
                 include: { summary: true }
             });
             
             if (closedTickets.length > 0 && client.aiNamespace && client.aiNamespace.sockets.size > 0) {
                 const ticketData = closedTickets.map((t: any) => `Ticket ${t.number} | Subject: ${t.subject} | Sentiment: ${t.summary?.sentiment ?? "unknown"} | Summary: ${t.summary?.summary ?? "None"}`).slice(0, 30).join("\\n");
                 const aiSocket = Array.from(client.aiNamespace.sockets.values())[0] as any;
                 
                 aiSocket.emit("query:generateMoraleReport", { data: ticketData }, async (res: any) => {
                    if (res && res.text) {
                        const moraleEmbed = new EmbedBuilder()
                            .setTitle("🧠 Daily AI Sentiment Report")
                            .setDescription(res.text)
                            .setColor(0x00FF00)
                            .setFooter({ text: `Analyzed ${closedTickets.length} tickets from the last 24h` });
                        await (channel as any).send({ embeds: [moraleEmbed] }).catch(() => {});
                    }
                 });
             }
          } catch (err) {
              logger.error(`Failed to generate morale report for guild ${guildConfig.id}`, err);
          }

          // Weekly FAQ Generator (Mondays)
          if (now.getDay() === 1) {
              try {
                 const lastWeek = new Date();
                 lastWeek.setDate(lastWeek.getDate() - 7);
                 
                 const weeklyTickets = await client.db.ticket.findMany({
                     where: { guildId: guildConfig.id, closedAt: { gte: lastWeek } },
                     include: { summary: true }
                 });

                 if (weeklyTickets.length > 0 && client.aiNamespace && client.aiNamespace.sockets.size > 0) {
                     const weeklyData = weeklyTickets.map((t: any) => `Subject: ${t.subject} | Type: ${t.category} | Summary: ${t.summary?.summary ?? "None"}`).slice(0, 100).join("\\n");
                     const aiSocket = Array.from(client.aiNamespace.sockets.values())[0] as any;
                     
                     aiSocket.emit("query:generateWeeklyFAQ", { data: weeklyData }, async (res: any) => {
                        if (res && res.text) {
                            const faqEmbed = new EmbedBuilder()
                                .setTitle("💡 AI Suggested FAQ Additions")
                                .setDescription("Based on last week's tickets, I suggest adding these to your Knowledge Base or FAQ channel:\\n\\n" + res.text)
                                .setColor(0xFFA500)
                                .setFooter({ text: `Analyzed ${weeklyTickets.length} tickets from the last 7 days` });
                            await (channel as any).send({ embeds: [faqEmbed] }).catch(() => {});
                        }
                     });
                 }
              } catch (err) {
                  logger.error(`Failed to generate FAQ for guild ${guildConfig.id}`, err);
              }
          }

        }
      } catch (err) {
        logger.error("Failed to run daily summary:", err);
      }
    }
  }, 60_000);
}

export default event;
