import express from "express";
import session from "express-session";
import { createServer } from "http";
import { Server as SocketIOServer, type Namespace } from "socket.io";
import type { Bot } from "../client/Bot.js";
import { logger } from "../utils/index.js";
import { TicketService } from "../services/TicketService.js";

declare module "express-session" {
  interface SessionData {
    user?: {
      id: string;
      username: string;
      avatar: string;
      accessToken: string;
    };
  }
}

interface ServerToClientEvents {
  stats: (data: GuildStats) => void;
  ticketMessage: (data: TicketMessageData) => void;
  ticketUpdate: (data: TicketUpdateData) => void;
  log: (data: LogData) => void;
  memberJoin: (data: MemberData) => void;
  memberLeave: (data: MemberData) => void;
  dashboardLog: (data: DashboardLogData) => void;
}

interface ClientToServerEvents {
  joinGuild: (guildId: string) => void;
  leaveGuild: (guildId: string) => void;
  joinTicket: (ticketId: string) => void;
  leaveTicket: (ticketId: string) => void;
  sendTicketMessage: (data: { ticketId: string; content: string }) => void;
}

interface GuildStats {
  members: number;
  online: number;
  tickets: { open: number; total: number };
  messages24h: number;
  voiceUsers: number;
  boosts: number;
}

interface TicketMessageData {
  ticketId: string;
  author: { id: string; username: string; avatar: string };
  content: string;
  timestamp: string;
}

interface TicketUpdateData {
  ticketId: string;
  status: string;
  claimedBy?: string;
}

interface LogData {
  type: string;
  message: string;
  data: any;
  timestamp: string;
}

interface MemberData {
  id: string;
  username: string;
  avatar: string;
}

interface DashboardLogData {
  action: string;
  user: string;
  details: string;
  timestamp: string;
}

export function startWebServer(client: Bot, port: number = 3000): { app: ReturnType<typeof express>; io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>; httpServer: ReturnType<typeof createServer>; aiNamespace: Namespace } {
  const app = express();
  const httpServer = createServer(app);
  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: "*" },
  });

  const clientId = process.env["CLIENT_ID"]!;
  const clientSecret = process.env["CLIENT_SECRET"]!;
  const webUrl = process.env["WEB_URL"] ?? `http://localhost:${port}`;
  const redirectUri = `${webUrl}/auth/callback`;

  (app as any).client = client;
  (app as any).io = io;

  app.use(express.json());

  const sessionMiddleware = session({
    secret: process.env["SESSION_SECRET"] ?? "super-secret-key-change-me",
    resave: true,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      secure: webUrl.startsWith("https"),
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  });

  app.use(sessionMiddleware);
  io.engine.use(sessionMiddleware);

  const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.session.user) {
      req.session.save(() => {
        res.redirect(`/auth/login?redirect=${encodeURIComponent(req.originalUrl)}`);
      });
      return;
    }
    next();
  };

  // Dashboard log helper
  async function logDashboardAction(guildId: string, userId: string, action: string, details: string) {
    const timestamp = new Date().toISOString();
    io.to(`guild:${guildId}`).emit("dashboardLog", { action, user: userId, details, timestamp });

    // Save to database
    await client.db.dashboardLog.create({
      data: { guildId, userId, action, details, timestamp: new Date() }
    }).catch(() => {});

    // Send to Discord channel if configured
    const config = await client.db.guild.findUnique({ where: { id: guildId } });
    if (config?.dashboardLogsChannel) {
      const channel = client.channels.cache.get(config.dashboardLogsChannel);
      if (channel?.isTextBased() && !channel.isDMBased()) {
        const user = await client.users.fetch(userId).catch(() => null);
        const { EmbedBuilder } = await import("discord.js");
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setAuthor({ name: "Dashboard Activity", ...(client.user && { iconURL: client.user.displayAvatarURL() }) })
          .setDescription(`**${action}**\n${details}`)
          .addFields({ name: "User", value: user ? `${user.tag} (${userId})` : userId, inline: true })
          .setTimestamp()
          .setFooter({ text: "Dashboard Logs" });
        await (channel as any).send({ embeds: [embed] }).catch(() => {});
      }
    }
  }

  // Socket.IO
  io.on("connection", (socket) => {
    const session = (socket.request as any).session;
    if (!session?.user) {
      socket.disconnect();
      return;
    }

    const userId = session.user.id;

    socket.on("joinGuild", async (guildId) => {
      const hasAccess = await verifyGuildAccess(session.user.accessToken, guildId, client);
      if (hasAccess) {
        socket.join(`guild:${guildId}`);
        const stats = await getGuildStats(guildId, client);
        socket.emit("stats", stats);
      }
    });

    socket.on("leaveGuild", (guildId) => socket.leave(`guild:${guildId}`));

    socket.on("joinTicket", (ticketId) => socket.join(`ticket:${ticketId}`));
    socket.on("leaveTicket", (ticketId) => socket.leave(`ticket:${ticketId}`));

    socket.on("sendTicketMessage", async (data) => {
      const { ticketId, content } = data;
      const ticket = await client.db.ticket.findUnique({ where: { id: parseInt(ticketId) } });
      if (!ticket) return;

      const channel = client.channels.cache.get(ticket.channelId);
      if (!channel?.isTextBased()) return;

      const user = await client.users.fetch(userId).catch(() => null);
      await (channel as any).send({ content: `**[Dashboard]** ${user?.username ?? "Staff"}: ${content}` });

      io.to(`ticket:${ticketId}`).emit("ticketMessage", {
        ticketId,
        author: { id: userId, username: session.user.username, avatar: session.user.avatar },
        content,
        timestamp: new Date().toISOString(),
      });
    });
  });

  // ===== AI NAMESPACE (/ai) =====
  const aiSecret = process.env["AI_SECRET"];
  const aiNamespace = io.of("/ai");

  aiNamespace.use((socket, next) => {
    const secret = socket.handshake.auth?.["secret"];
    if (!aiSecret || secret !== aiSecret) {
      return next(new Error("Unauthorized: invalid AI_SECRET"));
    }
    next();
  });

  aiNamespace.on("connection", (socket) => {
    logger.info("AI Client connected to /ai namespace");

    // ===== Actions from AI Client =====

    socket.on("action:assignRole" as any, async (data: any, callback: any) => {
      try {
        const guild = client.guilds.cache.get(data.guildId);
        if (!guild) return callback({ success: false, error: "Guild not found" });
        const member = await guild.members.fetch(data.userId).catch(() => null);
        if (!member) return callback({ success: false, error: "Member not found" });
        await member.roles.add(data.roleId);
        callback({ success: true });
      } catch (err: any) {
        callback({ success: false, error: err.message });
      }
    });

    socket.on("action:closeTicket" as any, async (data: any, callback: any) => {
      try {
        const channel = client.channels.cache.get(data.channelId);
        if (!channel?.isTextBased() || channel.isDMBased()) {
          return callback({ success: false, error: "Channel not found" });
        }
        const ticketService = new TicketService(client);
        await ticketService.closeTicket(channel as any, client.user!);
        callback({ success: true });
      } catch (err: any) {
        callback({ success: false, error: err.message });
      }
    });

    socket.on("action:sendAsBot" as any, async (data: any, callback: any) => {
      try {
        const channel = client.channels.cache.get(data.channelId);
        if (!channel?.isTextBased() || channel.isDMBased()) {
          return callback({ success: false, error: "Channel not found" });
        }
        if (data.embed) {
          const { EmbedBuilder } = await import("discord.js");
          const embed = new EmbedBuilder()
            .setDescription(data.embed.description);
          if (data.embed.title) embed.setTitle(data.embed.title);
          if (data.embed.color) embed.setColor(data.embed.color);
          if (data.embed.footer) embed.setFooter({ text: data.embed.footer });
          await (channel as any).send({ embeds: [embed] });
        } else if (data.content) {
          await (channel as any).send({ content: data.content });
        }
        callback({ success: true });
      } catch (err: any) {
        callback({ success: false, error: err.message });
      }
    });

    socket.on("action:addTodo" as any, async (data: any, callback: any) => {
      try {
        const todo = await client.db.todo.create({
          data: {
            guildId: data.guildId,
            title: data.title,
            description: data.description ?? null,
            priority: data.priority ?? "normal",
            assigneeId: data.assigneeId ?? null,
            fromTicketId: data.fromTicketId ?? null,
          },
        });

        // Notify assignee if set and guild has a todo channel
        const guildConfig = await client.db.guild.findUnique({ where: { id: data.guildId } });
        if (guildConfig?.aiTodoChannel) {
          const todoChannel = client.channels.cache.get(guildConfig.aiTodoChannel);
          if (todoChannel?.isTextBased() && !todoChannel.isDMBased()) {
            const { EmbedBuilder } = await import("discord.js");
            const embed = new EmbedBuilder()
              .setTitle(`📋 New Task`)
              .setDescription([
                `**${data.title}**`,
                data.description ? `\n${data.description}` : "",
                `\nPriority: **${data.priority ?? "normal"}**`,
                data.assigneeId ? `\nAssigned to: <@${data.assigneeId}>` : "",
              ].join(""))
              .setColor(data.priority === "urgent" ? 0xed4245 : data.priority === "high" ? 0xfee75c : 0x5865f2)
              .setTimestamp();
            await (todoChannel as any).send({
              content: data.assigneeId ? `<@${data.assigneeId}>` : undefined,
              embeds: [embed],
            });
          }
        }

        callback({ success: true, todoId: todo.id });
      } catch (err: any) {
        callback({ success: false, error: err.message });
      }
    });

    socket.on("action:escalate" as any, async (data: any, callback: any) => {
      try {
        const guildConfig = await client.db.guild.findUnique({ where: { id: data.guildId } });
        const guild = client.guilds.cache.get(data.guildId);
        if (!guild) return callback({ success: false, error: "Guild not found" });

        const ticket = await client.db.ticket.findUnique({ where: { channelId: data.channelId } });
        const ticketTitle = ticket ? `Ticket #${ticket.number.toString().padStart(4, "0")}${ticket.subject ? ` - ${ticket.subject}` : ""}` : `Ticket <#${data.channelId}>`;

        // Find best team member
        let teamMember = null;
        if (data.specialtyNeeded) {
          teamMember = await client.db.teamMember.findFirst({
            where: {
              guildId: data.guildId,
              available: true,
              specialties: { contains: data.specialtyNeeded },
            },
          });
        }
        if (!teamMember) {
          teamMember = await client.db.teamMember.findFirst({
            where: { guildId: data.guildId, available: true },
          });
        }

        const notifyChannelId = data.level === "critical" ? guildConfig?.aiUrgentChannel : guildConfig?.aiTodoChannel;
        const dedicatedChannel = notifyChannelId ? guild.channels.cache.get(notifyChannelId) : null;
        const ticketChannel = guild.channels.cache.get(data.channelId);

        let pingText = "";
        if (data.level === "critical" && !teamMember) {
          pingText = "@everyone";
        } else if (teamMember) {
          pingText = `<@${teamMember.userId}>`;
        } else if (guildConfig?.ticketSupportRole) {
          pingText = `<@&${guildConfig.ticketSupportRole}>`;
        }

        const { EmbedBuilder } = await import("discord.js");
        const embed = new EmbedBuilder()
          .setTitle(`🚨 Priority Support : ${ticketTitle}`)
          .setDescription(`**Reason:** ${data.reason}\n**Channel:** <#${data.channelId}>`)
          .setColor(data.level === "critical" ? 0xed4245 : 0xfee75c)
          .setTimestamp()
          .setFooter({ text: `Team Notification` });

        if (dedicatedChannel?.isTextBased() && !dedicatedChannel.isDMBased()) {
          await (dedicatedChannel as any).send({
            content: pingText || undefined,
            embeds: [embed],
          });
          
          if (ticketChannel?.isTextBased() && !ticketChannel.isDMBased()) {
            await (ticketChannel as any).send({
              content: pingText || undefined,
            });
          }
        } else if (ticketChannel?.isTextBased() && !ticketChannel.isDMBased()) {
          await (ticketChannel as any).send({
            content: pingText || undefined,
            embeds: [embed],
          });
        }

        // Also DM the team member directly for high/critical if possible
        if ((data.level === "high" || data.level === "critical") && teamMember) {
          const member = await guild.members.fetch(teamMember.userId).catch(() => null);
          if (member) {
            try {
              await member.send(`⚠️ **Escalation** in <#${data.channelId}>: ${data.reason}`);
            } catch {}
          }
        }

        // Add to Todo database
        try {
          await client.db.todo.create({
            data: {
              guildId: data.guildId,
              title: `[Escalation] ${ticketTitle}`,
              description: data.reason,
              priority: data.level === "critical" ? "urgent" : data.level === "high" ? "high" : "normal",
              assigneeId: teamMember ? teamMember.userId : null,
              fromTicketId: ticket ? ticket.id : null,
            }
          });
        } catch (err) {
          logger.error(`Failed to create Todo for escalation in ${data.channelId}:`, err);
        }

        callback({ success: true });
      } catch (err: any) {
        callback({ success: false, error: err.message });
      }
    });

    socket.on("action:acceptReview" as any, async (data: any, callback: any) => {
      try {
        const ticket = await client.db.ticket.findUnique({
          where: { id: data.ticketId },
          include: { guild: true },
        });
        if (!ticket || !ticket.review || !ticket.reviewRating) {
          return callback({ success: false, error: "No review found" });
        }
        const ticketService = new TicketService(client);
        await ticketService.publishReview(data.ticketId, ticket.review, ticket.reviewRating);

        // Update the review message in the review channel to show who accepted it
        const aiPersona = process.env["AI_PERSONA_NAME"] ?? "AI Assistant";
        const guild = client.guilds.cache.get(ticket.guildId);
        if (guild && ticket.guild.ticketReviewChannel) {
          const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import("discord.js");
          const reviewChannel = guild.channels.cache.get(ticket.guild.ticketReviewChannel);
          if (reviewChannel?.isTextBased() && !reviewChannel.isDMBased()) {
            // Find the review message with the matching button
            const messages = await (reviewChannel as any).messages.fetch({ limit: 50 });
            const reviewMsg = messages.find((m: any) =>
              m.components?.some((row: any) =>
                row.components?.some((c: any) => c.customId === `review_accept_${ticket.id}`)
              )
            );
            if (reviewMsg) {
              await reviewMsg.edit({
                components: [
                  new ActionRowBuilder<any>().addComponents(
                    new ButtonBuilder()
                      .setCustomId(`review_done_${ticket.id}`)
                      .setLabel(`Accepted by ${aiPersona}`)
                      .setStyle(ButtonStyle.Success)
                      .setDisabled(true)
                  ),
                ],
              });
            }
          }
        }

        callback({ success: true });
      } catch (err: any) {
        callback({ success: false, error: err.message });
      }
    });

    socket.on("action:requestReview" as any, async (data: any, callback: any) => {
      try {
        const ticket = await client.db.ticket.findUnique({
          where: { id: data.ticketId },
          include: { guild: true },
        });

        const user = await client.users.fetch(data.userId).catch(() => null);
        if (user && ticket) {
          const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import("discord.js");
          const guild = client.guilds.cache.get(data.guildId);

          try {
            const dmEmbed = new EmbedBuilder()
              .setTitle("💬 How was your experience?")
              .setDescription([
                `Thanks for using the support of **${guild?.name ?? "our server"}**!`,
                "",
                `**Ticket:** #${ticket.number.toString().padStart(4, "0")}`,
                ticket.subject ? `**Subject:** ${ticket.subject}` : null,
                "",
                "We'd love to hear your feedback!",
              ].filter(Boolean).join("\n"))
              .setColor(0x5865f2)
              .setFooter({ text: guild?.name ?? "Support" });

            const dmButton = new ActionRowBuilder<any>().addComponents(
              new ButtonBuilder()
                .setCustomId(`review_write_${ticket.id}_${data.guildId}`)
                .setLabel("Leave a review")
                .setStyle(ButtonStyle.Primary)
                .setEmoji("⭐")
            );

            await user.send({ embeds: [dmEmbed], components: [dmButton] });

            await client.db.ticket.update({
              where: { id: ticket.id },
              data: { status: "review_pending" },
            });
          } catch {
            // DMs closed
          }

          // Update the transcript message's button to show who requested it
          const aiPersona = process.env["AI_PERSONA_NAME"] ?? "AI Assistant";
          if (guild && ticket.guild.ticketTranscriptChannel) {
            const transcriptChannel = guild.channels.cache.get(ticket.guild.ticketTranscriptChannel);
            if (transcriptChannel?.isTextBased() && !transcriptChannel.isDMBased()) {
              const messages = await (transcriptChannel as any).messages.fetch({ limit: 50 });
              const transcriptMsg = messages.find((m: any) =>
                m.components?.some((row: any) =>
                  row.components?.some((c: any) => c.customId === `review_request_${ticket.id}`)
                )
              );
              if (transcriptMsg) {
                // Rebuild with link button intact + updated feedback button
                const transcriptUrl = transcriptMsg.embeds?.[0]?.description?.match(/\[View transcript online\]\((.*?)\)/)?.[1];
                const newButtons = new ActionRowBuilder<any>();

                if (transcriptUrl) {
                  newButtons.addComponents(
                    new ButtonBuilder()
                      .setLabel("View online")
                      .setStyle(ButtonStyle.Link)
                      .setURL(transcriptUrl)
                      .setEmoji("🌐")
                  );
                }

                newButtons.addComponents(
                  new ButtonBuilder()
                    .setCustomId(`review_request_${ticket.id}`)
                    .setLabel(`Feedback requested by ${aiPersona}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji("✅")
                    .setDisabled(true)
                );

                await transcriptMsg.edit({ components: [newButtons] });
              }
            }
          }
        }

        callback({ success: true });
      } catch (err: any) {
        callback({ success: false, error: err.message });
      }
    });

    socket.on("action:requestClose" as any, async (data: any, callback: any) => {
      try {
        const channel = client.channels.cache.get(data.channelId);
        if (!channel?.isTextBased() || channel.isDMBased()) {
          return callback({ success: false, error: "Channel not found" });
        }

        const ticket = await client.db.ticket.findUnique({ where: { channelId: data.channelId } });
        if (!ticket || ticket.status !== "open") {
          return callback({ success: false, error: "Ticket not found or already closed" });
        }

        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import("discord.js");

        const embed = new EmbedBuilder()
          .setTitle("🔒 Close this ticket?")
          .setDescription([
            "It looks like your issue has been resolved!",
            "",
            "You can **close** the ticket, or **leave a review** to help us improve.",
          ].join("\n"))
          .setColor(0x5865f2)
          .setFooter({ text: `Ticket #${ticket.number.toString().padStart(4, "0")}` })
          .setTimestamp();

        const row = new ActionRowBuilder<any>().addComponents(
          new ButtonBuilder()
            .setCustomId(`closeconfirm_${ticket.id}`)
            .setLabel("Close ticket")
            .setStyle(ButtonStyle.Danger)
            .setEmoji("🔒"),
          new ButtonBuilder()
            .setCustomId(`closereview_${ticket.id}`)
            .setLabel("Close + Leave a review")
            .setStyle(ButtonStyle.Primary)
            .setEmoji("⭐"),
          new ButtonBuilder()
            .setCustomId(`closekeep`)
            .setLabel("Keep open")
            .setStyle(ButtonStyle.Secondary)
        );

        await (channel as any).send({ embeds: [embed], components: [row] });
        callback({ success: true });
      } catch (err: any) {
        callback({ success: false, error: err.message });
      }
    });

    // ===== Cost Tracking Actions =====

    socket.on("action:saveTicketCost" as any, async (data: any, callback: any) => {
      try {
        const ticket = await client.db.ticket.findUnique({ where: { channelId: data.channelId } });
        if (ticket) {
          const existing = await client.db.aITicketCost.findUnique({ where: { ticketId: ticket.id } });
          const modelsSet = new Set(data.modelsUsed || []);
          if (existing && existing.modelsUsed) {
            try {
               const parsed = JSON.parse(existing.modelsUsed as string);
               if (Array.isArray(parsed)) parsed.forEach(m => modelsSet.add(m));
            } catch {}
          }

          await client.db.aITicketCost.upsert({
            where: { ticketId: ticket.id },
            update: {
              modelsUsed: JSON.stringify(Array.from(modelsSet)),
              updatedAt: new Date()
            },
            create: {
              ticketId: ticket.id,
              channelId: data.channelId,
              guildId: data.guildId,
              totalCost: data.totalCost || 0,
              totalCalls: data.totalCalls || 0,
              modelsUsed: JSON.stringify(Array.from(modelsSet))
            }
          });
        }
        callback({ success: true });
      } catch (err: any) {
        callback({ success: false, error: err.message });
      }
    });

    socket.on("action:trackAICost" as any, async (data: any, callback: any) => {
      try {
        await client.db.aIRequestLog.create({
          data: {
            model: data.model,
            tokensIn: data.tokensIn,
            tokensOut: data.tokensOut,
            cachedTokens: data.cachedTokens,
            cost: data.cost,
            latencyMs: data.latencyMs,
            taskType: data.taskType,
            ticketId: data.ticketId,
            guildId: data.guildId,
            date: new Date().toISOString().split("T")[0]!
          }
        });

        // Incrementally update ticket cost
        if (data.ticketId) {
          const ticket = await client.db.ticket.findUnique({ where: { channelId: data.ticketId } });
          if (ticket) {
            await client.db.aITicketCost.upsert({
              where: { ticketId: ticket.id },
              update: {
                totalCost: { increment: data.cost },
                totalCalls: { increment: 1 },
                updatedAt: new Date()
              },
              create: {
                ticketId: ticket.id,
                channelId: data.ticketId,
                guildId: data.guildId ?? "unknown",
                totalCost: data.cost,
                totalCalls: 1,
                modelsUsed: JSON.stringify([data.model])
              }
            });
            
            // For updates, we can't easily append to the JSON array of modelsUsed in prisma,
            // but the final saveTicketCost on ticket close will overwrite it with the complete Set of models anyway.
          }
        }

        callback({ success: true });
      } catch (err: any) {
        callback({ success: false, error: err.message });
      }
    });

    socket.on("action:saveDaySummary" as any, async (data: any, callback: any) => {
      try {
        await client.db.aIBudgetDay.upsert({
          where: { date: data.date },
          update: {
            totalSpend: data.totalSpend,
            totalRequests: data.totalRequests,
            totalTokensIn: data.totalTokensIn,
            totalTokensOut: data.totalTokensOut,
            totalCached: data.totalCached,
            avgCostPerTicket: data.avgCostPerTicket,
            byModel: data.byModel,
            byTaskType: data.byTaskType,
            updatedAt: new Date()
          },
          create: {
            date: data.date,
            totalSpend: data.totalSpend,
            totalRequests: data.totalRequests,
            totalTokensIn: data.totalTokensIn,
            totalTokensOut: data.totalTokensOut,
            totalCached: data.totalCached,
            avgCostPerTicket: data.avgCostPerTicket,
            byModel: data.byModel,
            byTaskType: data.byTaskType,
          }
        });
        callback({ success: true });
      } catch (err: any) {
        callback({ success: false, error: err.message });
      }
    });

    // ===== Queries from AI Client =====

    socket.on("query:ticket" as any, async (data: any, callback: any) => {
      try {
        const where: any = {};
        if (data.ticketId) where.id = data.ticketId;
        else if (data.channelId) where.channelId = data.channelId;
        const ticket = await client.db.ticket.findFirst({ where });
        callback(ticket ?? null);
      } catch {
        callback(null);
      }
    });

    socket.on("query:services" as any, async (data: any, callback: any) => {
      try {
        const where: any = { guildId: data.guildId };
        if (data.category) where.category = data.category;
        const services = await client.db.service.findMany({
          where,
          orderBy: { position: "asc" },
        });
        callback(services.map((s: any) => ({
          ...s,
          features: JSON.parse(s.features || "[]"),
        })));
      } catch {
        callback([]);
      }
    });

    socket.on("query:teamMembers" as any, async (data: any, callback: any) => {
      try {
        const where: any = { guildId: data.guildId };
        if (data.available !== undefined) where.available = data.available;
        let members = await client.db.teamMember.findMany({ where });

        if (data.specialty) {
          members = members.filter((m: any) => {
            const specs = JSON.parse(m.specialties || "[]");
            return specs.includes(data.specialty);
          });
        }

        callback(members.map((m: any) => ({
          ...m,
          specialties: JSON.parse(m.specialties || "[]"),
        })));
      } catch {
        callback([]);
      }
    });

    socket.on("query:knowledge" as any, async (data: any, callback: any) => {
      try {
        const where: any = { guildId: data.guildId };
        if (data.category) where.category = data.category;
        const entries = await client.db.aIKnowledge.findMany({
          where,
          orderBy: [{ category: "asc" }, { key: "asc" }],
        });
        callback(entries.map((e: any) => ({
          category: e.category,
          key: e.key,
          value: e.value,
        })));
      } catch {
        callback([]);
      }
    });

    socket.on("query:userHistory" as any, async (data: any, callback: any) => {
      try {
        const tickets = await client.db.ticket.findMany({
          where: { guildId: data.guildId, userId: data.userId },
          orderBy: { createdAt: "desc" },
          take: 10,
        });

        const memories = await client.db.aIMemory.findMany({
          where: { guildId: data.guildId, userId: data.userId },
          orderBy: { importance: "desc" },
          take: 10,
        });

        callback({
          tickets: tickets.map((t: any) => ({
            id: t.id,
            number: t.number,
            category: t.category,
            subject: t.subject,
            status: t.status,
            createdAt: t.createdAt.toISOString(),
          })),
          memories: memories.map((m: any) => ({
            type: m.type,
            content: m.content,
            importance: m.importance,
            createdAt: m.createdAt.toISOString(),
          })),
        });
      } catch {
        callback({ tickets: [], memories: [] });
      }
    });

    // ===== DM Thread Actions =====

    socket.on("action:createDMThread" as any, async (data: any, callback: any) => {
      try {
        const channel = client.channels.cache.get(data.channelId);
        if (!channel?.isTextBased() || channel.isDMBased()) {
          return callback({ success: false, error: "DM log channel not found" });
        }

        const thread = await (channel as any).threads.create({
          name: data.threadName,
          autoArchiveDuration: 1440, // 24h
          reason: `DM log thread for ${data.username} (${data.userId})`,
        });

        // Send initial message in thread
        const { EmbedBuilder } = await import("discord.js");
        const embed = new EmbedBuilder()
          .setTitle(`DM Conversation: ${data.username}`)
          .setDescription(`User: <@${data.userId}> (\`${data.userId}\`)\nThread created for logging DM exchanges.`)
          .setColor(0x5865f2)
          .setTimestamp();
        await thread.send({ embeds: [embed] });

        callback({ success: true, threadId: thread.id });
      } catch (err: any) {
        callback({ success: false, error: err.message });
      }
    });

    socket.on("action:sendToThread" as any, async (data: any, callback: any) => {
      try {
        const thread = client.channels.cache.get(data.threadId);
        if (!thread?.isTextBased()) {
          return callback({ success: false, error: "Thread not found" });
        }

        if (data.embed) {
          const { EmbedBuilder } = await import("discord.js");
          const embed = new EmbedBuilder()
            .setDescription(data.embed.description);
          if (data.embed.title) embed.setTitle(data.embed.title);
          if (data.embed.color) embed.setColor(data.embed.color);
          if (data.embed.footer) embed.setFooter({ text: data.embed.footer });
          if (data.embed.author) embed.setAuthor({ name: data.embed.author });
          await (thread as any).send({ embeds: [embed] });
        } else if (data.content) {
          await (thread as any).send({ content: data.content });
        }
        callback({ success: true });
      } catch (err: any) {
        callback({ success: false, error: err.message });
      }
    });

    // ===== Reminder Actions =====

    socket.on("action:createReminder" as any, async (data: any, callback: any) => {
      try {
        const reminder = await client.db.aIReminder.create({
          data: {
            guildId: data.guildId ?? null,
            userId: data.userId,
            targetUserId: data.targetUserId ?? null,
            content: data.content,
            channelId: data.channelId ?? null,
            triggerAt: new Date(data.triggerAt),
            sourceType: data.sourceType ?? "ticket",
            sourceId: data.sourceId ?? null,
          },
        });
        callback({ success: true, reminderId: reminder.id });
      } catch (err: any) {
        callback({ success: false, error: err.message });
      }
    });

    // ===== Memory Actions =====

    socket.on("action:createMemory" as any, async (data: any, callback: any) => {
      try {
        const memory = await client.db.aIMemory.create({
          data: {
            guildId: data.guildId,
            userId: data.userId,
            type: data.type,
            content: data.content,
            importance: data.importance ?? 5,
          },
        });
        callback({ success: true, memoryId: memory.id });
      } catch (err: any) {
        callback({ success: false, error: err.message });
      }
    });

    socket.on("disconnect", () => {
      logger.info("AI Client disconnected from /ai namespace");
    });
  });

  // Store AI namespace on the app for access from other modules
  (app as any).aiNamespace = aiNamespace;

  // ===== AUTH ROUTES =====
  app.get("/auth/login", (req, res) => {
    const redirect = (req.query['redirect'] as string) || "/dashboard";
    const state = Buffer.from(JSON.stringify({ redirect })).toString("base64");
    const authUrl = new URL("https://discord.com/api/oauth2/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "identify guilds");
    authUrl.searchParams.set("state", state);
    res.redirect(authUrl.toString());
  });

  app.get("/auth/callback", async (req, res) => {
    const code = req.query['code'] as string;
    const state = req.query['state'] as string;
    if (!code) return res.redirect("/?error=no_code");

    try {
      const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        }),
      });

      const tokenData = await tokenResponse.json() as { access_token?: string };
      if (!tokenData.access_token) return res.redirect(`/?error=token_failed`);

      const userResponse = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userData = await userResponse.json() as { id: string; username: string; avatar: string };

      req.session.user = {
        id: userData.id,
        username: userData.username,
        avatar: userData.avatar,
        accessToken: tokenData.access_token,
      };

      let redirect = "/dashboard";
      if (state) {
        try {
          const stateData = JSON.parse(Buffer.from(state, "base64").toString());
          redirect = stateData.redirect || "/dashboard";
        } catch {}
      }

      req.session.save(() => res.redirect(redirect));
    } catch {
      res.redirect("/?error=oauth_failed");
    }
  });

  app.get("/auth/logout", (req, res) => req.session.destroy(() => res.redirect("/")));

  // ===== API ROUTES =====
  app.get("/api/guilds", requireAuth, async (req, res) => {
    try {
      const user = req.session.user!;
      const guildsResponse = await fetch("https://discord.com/api/users/@me/guilds", {
        headers: { Authorization: `Bearer ${user.accessToken}` },
      });
      const userGuilds = await guildsResponse.json() as { id: string; name: string; icon: string; permissions: string }[];
      const botGuilds = client.guilds.cache;

      const accessibleGuilds = userGuilds
        .filter((g) => {
          const permissions = BigInt(g.permissions);
          const hasPermission = (permissions & BigInt(0x8)) !== BigInt(0) || (permissions & BigInt(0x20)) !== BigInt(0);
          return hasPermission && botGuilds.has(g.id);
        })
        .map((g: any) => ({
          id: g.id,
          name: g.name,
          icon: g.icon,
          memberCount: botGuilds.get(g.id)?.memberCount ?? 0,
        }));

      res.json(accessibleGuilds);
    } catch {
      res.status(500).json({ error: "Failed to fetch guilds" });
    }
  });

  app.get("/api/guilds/:guildId/stats", requireAuth, async (req, res) => {
    try {
      const stats = await getGuildStats(req.params['guildId']!, client);
      res.json(stats);
    } catch {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get("/api/guilds/:guildId/channels", requireAuth, async (req, res) => {
    try {
      const guild = client.guilds.cache.get(req.params['guildId']!);
      if (!guild) return res.status(404).json({ error: "Guild not found" });

      const channels = guild.channels.cache
        .filter((c) => c.isTextBased() && !c.isThread() && !c.isDMBased())
        .map((c) => ({ id: c.id, name: c.name, type: c.type, parentId: (c as any).parentId }))
        .sort((a, b) => a.name.localeCompare(b.name));

      res.json(channels);
    } catch {
      res.status(500).json({ error: "Failed to fetch channels" });
    }
  });

  app.get("/api/guilds/:guildId/categories", requireAuth, async (req, res) => {
    try {
      const guild = client.guilds.cache.get(req.params['guildId']!);
      if (!guild) return res.status(404).json({ error: "Guild not found" });

      const categories = guild.channels.cache
        .filter((c) => c.type === 4)
        .map((c) => ({ id: c.id, name: c.name }))
        .sort((a, b) => a.name.localeCompare(b.name));

      res.json(categories);
    } catch {
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.get("/api/guilds/:guildId/roles", requireAuth, async (req, res) => {
    try {
      const guild = client.guilds.cache.get(req.params['guildId']!);
      if (!guild) return res.status(404).json({ error: "Guild not found" });

      const roles = guild.roles.cache
        .filter((r) => r.id !== guild.id && !r.managed)
        .map((r) => ({ id: r.id, name: r.name, color: r.hexColor, position: r.position }))
        .sort((a, b) => b.position - a.position);

      res.json(roles);
    } catch {
      res.status(500).json({ error: "Failed to fetch roles" });
    }
  });

  app.get("/api/guilds/:guildId/emojis", requireAuth, async (req, res) => {
    try {
      const guild = client.guilds.cache.get(req.params['guildId']!);
      if (!guild) return res.status(404).json({ error: "Guild not found" });

      const emojis = guild.emojis.cache.map((e) => ({
        id: e.id,
        name: e.name,
        animated: e.animated,
        url: e.url,
      }));

      res.json(emojis);
    } catch {
      res.status(500).json({ error: "Failed to fetch emojis" });
    }
  });

  app.get("/api/guilds/:guildId/config", requireAuth, async (req, res) => {
    try {
      const guildId = req.params['guildId']!;
      let config = await client.db.guild.findUnique({ where: { id: guildId } });
      if (!config) config = await client.db.guild.create({ data: { id: guildId } });
      res.json(config);
    } catch {
      res.status(500).json({ error: "Failed to fetch config" });
    }
  });

  app.put("/api/guilds/:guildId/config", requireAuth, async (req, res) => {
    try {
      const guildId = req.params['guildId']!;
      const config = await client.db.guild.upsert({
        where: { id: guildId },
        update: req.body,
        create: { id: guildId, ...req.body },
      });
      await logDashboardAction(req.params['guildId']!, req.session.user!.id, "Config Updated", `Updated: ${Object.keys(req.body).join(", ")}`);
      res.json(config);
    } catch {
      res.status(500).json({ error: "Failed to update config" });
    }
  });

  // TICKETS API
  app.get("/api/guilds/:guildId/tickets", requireAuth, async (req, res) => {
    try {
      const { status, page = "1", limit = "50" } = req.query;
      const where: any = { guildId: req.params['guildId']! };
      if (status && status !== "all") where.status = status;

      const tickets = await client.db.ticket.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: parseInt(limit as string),
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      });

      const total = await client.db.ticket.count({ where });
      res.json({ tickets, total, page: parseInt(page as string), pages: Math.ceil(total / parseInt(limit as string)) });
    } catch {
      res.status(500).json({ error: "Failed to fetch tickets" });
    }
  });

  app.get("/api/guilds/:guildId/tickets/:ticketId", requireAuth, async (req, res) => {
    try {
      const ticket = await client.db.ticket.findFirst({
        where: { id: parseInt(req.params['ticketId']!), guildId: req.params['guildId']! },
      });
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });

      // Fetch messages from channel if open
      let messages: any[] = [];
      if (ticket.status === "open") {
        const channel = client.channels.cache.get(ticket.channelId);
        if (channel?.isTextBased()) {
          const discordMessages = await (channel as any).messages.fetch({ limit: 100 });
          messages = discordMessages.map((m: any) => ({
            id: m.id,
            content: m.content,
            author: { id: m.author.id, username: m.author.username, avatar: m.author.avatar },
            timestamp: m.createdTimestamp,
            embeds: m.embeds.map((e: any) => e.toJSON()),
            attachments: m.attachments.map((a: any) => ({ url: a.url, name: a.name })),
          })).reverse();
        }
      } else {
        // Get transcript
        const transcript = await client.db.transcript.findFirst({ where: { ticketId: ticket.id } });
        if (transcript) (ticket as any).transcriptId = transcript.id;
      }

      const user = await client.users.fetch(ticket.userId).catch(() => null);
      res.json({ ...ticket, messages, user: user ? { id: user.id, username: user.username, avatar: user.avatar } : null });
    } catch {
      res.status(500).json({ error: "Failed to fetch ticket" });
    }
  });

  app.post("/api/guilds/:guildId/tickets/:ticketId/close", requireAuth, async (req, res) => {
    try {
      const ticket = await client.db.ticket.findFirst({
        where: { id: parseInt(req.params['ticketId']!), guildId: req.params['guildId']!, status: "open" },
      });
      if (!ticket) return res.status(404).json({ error: "Ticket not found or already closed" });

      const { TicketService } = await import("../services/TicketService.js");
      const ticketService = new TicketService(client);
      const closer = await client.users.fetch(req.session.user!.id).catch(() => null);

      if (closer) {
        const ticketChannel = client.channels.cache.get(ticket.channelId);
        if (ticketChannel?.isTextBased() && !ticketChannel.isDMBased()) {
          await ticketService.closeTicket(ticketChannel as any, closer);
        }
        await logDashboardAction(req.params['guildId']!, req.session.user!.id, "Ticket Closed", `Closed ticket #${ticket.number}`);
      }

      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to close ticket" });
    }
  });

  // GIVEAWAYS API
  app.get("/api/guilds/:guildId/giveaways", requireAuth, async (req, res) => {
    try {
      const giveaways = await client.db.giveaway.findMany({
        where: { guildId: req.params['guildId']! },
        orderBy: { createdAt: "desc" },
      });
      res.json(giveaways);
    } catch {
      res.status(500).json({ error: "Failed to fetch giveaways" });
    }
  });

  app.post("/api/guilds/:guildId/giveaways", requireAuth, async (req, res) => {
    try {
      const { channelId, prize, duration, winners, requiredRole } = req.body;
      const channel = client.channels.cache.get(channelId);
      if (!channel?.isTextBased()) return res.status(400).json({ error: "Invalid channel" });

      const endsAt = new Date(Date.now() + duration * 1000);
      const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import("discord.js");

      const embed = new EmbedBuilder()
        .setTitle("🎉 GIVEAWAY 🎉")
        .setDescription(`**Prize:** ${prize}\n**Winners:** ${winners}\n**Ends:** <t:${Math.floor(endsAt.getTime() / 1000)}:R>`)
        .setColor(0x5865F2)
        .setFooter({ text: "React to participate!" })
        .setTimestamp(endsAt);

      const row = new ActionRowBuilder<any>().addComponents(
        new ButtonBuilder().setCustomId("giveaway_enter").setLabel("🎉 Enter").setStyle(ButtonStyle.Primary)
      );

      const msg = await (channel as any).send({ embeds: [embed], components: [row] });

      const giveaway = await client.db.giveaway.create({
        data: {
          guildId: req.params['guildId']!,
          channelId,
          messageId: msg.id,
          prize,
          winners,
          endsAt,
          hostId: req.session.user!.id,
          requiredRole: requiredRole || null,
        },
      });

      await logDashboardAction(req.params['guildId']!, req.session.user!.id, "Giveaway Created", `Prize: ${prize}, Winners: ${winners}`);
      res.json(giveaway);
    } catch {
      res.status(500).json({ error: "Failed to create giveaway" });
    }
  });

  app.delete("/api/guilds/:guildId/giveaways/:id", requireAuth, async (req, res) => {
    try {
      const giveaway = await client.db.giveaway.delete({ where: { id: parseInt(req.params['id']!) } });
      const channel = client.channels.cache.get(giveaway.channelId);
      if (channel?.isTextBased()) {
        const msg = await (channel as any).messages.fetch(giveaway.messageId).catch(() => null);
        if (msg) await msg.delete().catch(() => {});
      }
      await logDashboardAction(req.params['guildId']!, req.session.user!.id, "Giveaway Deleted", `Prize: ${giveaway.prize}`);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete giveaway" });
    }
  });

  app.post("/api/guilds/:guildId/giveaways/:id/reroll", requireAuth, async (req, res) => {
    try {
      const giveaway = await client.db.giveaway.findUnique({ where: { id: parseInt(req.params['id']!) } });
      if (!giveaway || !giveaway.ended) return res.status(400).json({ error: "Giveaway not found or not ended" });

      const participants = JSON.parse(giveaway.participants) as string[];
      if (participants.length === 0) return res.status(400).json({ error: "No participants" });

      const winner = participants[Math.floor(Math.random() * participants.length)];
      const channel = client.channels.cache.get(giveaway.channelId);
      if (channel?.isTextBased()) {
        await (channel as any).send(`🎉 New winner: <@${winner}>! Congratulations!`);
      }

      await logDashboardAction(req.params['guildId']!, req.session.user!.id, "Giveaway Rerolled", `Prize: ${giveaway.prize}`);
      res.json({ winner });
    } catch {
      res.status(500).json({ error: "Failed to reroll" });
    }
  });

  // REACTION ROLES API
  app.get("/api/guilds/:guildId/reaction-roles", requireAuth, async (req, res) => {
    try {
      const reactionRoles = await client.db.reactionRole.findMany({ where: { guildId: req.params['guildId']! } });
      res.json(reactionRoles);
    } catch {
      res.status(500).json({ error: "Failed to fetch reaction roles" });
    }
  });

  app.post("/api/guilds/:guildId/reaction-roles", requireAuth, async (req, res) => {
    try {
      const { channelId, title, description, color, roles } = req.body;
      const channel = client.channels.cache.get(channelId);
      if (!channel?.isTextBased()) return res.status(400).json({ error: "Invalid channel" });

      const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = await import("discord.js");

      const embed = new EmbedBuilder()
        .setTitle(title || "Role Selection")
        .setDescription(description || "Select a role below")
        .setColor(color ? parseInt(color.replace("#", ""), 16) : 0x5865F2);

      const options = roles.map((r: any) => ({
        label: r.name,
        value: r.roleId,
        ...(r.emoji && { emoji: r.emoji }),
        ...(r.description && { description: r.description }),
      }));

      const row = new ActionRowBuilder<any>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("reaction_role_select")
          .setPlaceholder("Select a role...")
          .setMinValues(0)
          .setMaxValues(roles.length)
          .addOptions(options)
      );

      const msg = await (channel as any).send({ embeds: [embed], components: [row] });

      for (const role of roles) {
        await client.db.reactionRole.create({
          data: {
            guildId: req.params['guildId']!,
            channelId,
            messageId: msg.id,
            roleId: role.roleId,
            emoji: role.emoji || null,
          },
        });
      }

      await logDashboardAction(req.params['guildId']!, req.session.user!.id, "Reaction Roles Created", `${roles.length} roles in channel`);
      res.json({ success: true, messageId: msg.id });
    } catch (e) {
      res.status(500).json({ error: "Failed to create reaction roles" });
    }
  });

  app.delete("/api/guilds/:guildId/reaction-roles/:messageId", requireAuth, async (req, res) => {
    try {
      const rrs = await client.db.reactionRole.findMany({ where: { messageId: req.params['messageId']! } });
      if (rrs.length > 0) {
        const channel = client.channels.cache.get(rrs[0]!.channelId);
        if (channel?.isTextBased()) {
          const msg = await (channel as any).messages.fetch(req.params['messageId']!).catch(() => null);
          if (msg) await msg.delete().catch(() => {});
        }
        await client.db.reactionRole.deleteMany({ where: { messageId: req.params['messageId']! } });
      }
      await logDashboardAction(req.params['guildId']!, req.session.user!.id, "Reaction Roles Deleted", `Message: ${req.params['messageId']!}`);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete reaction roles" });
    }
  });

  // AUTO ROLES API
  app.get("/api/guilds/:guildId/auto-roles", requireAuth, async (req, res) => {
    try {
      const autoRoles = await client.db.autoRole.findMany({ where: { guildId: req.params['guildId']! } });
      res.json(autoRoles);
    } catch {
      res.status(500).json({ error: "Failed to fetch auto roles" });
    }
  });

  app.post("/api/guilds/:guildId/auto-roles", requireAuth, async (req, res) => {
    try {
      const { roleId, type, delay } = req.body;
      const autoRole = await client.db.autoRole.create({
        data: { guildId: req.params['guildId']!, roleId, type: type || "join", delay: delay || 0 },
      });
      await logDashboardAction(req.params['guildId']!, req.session.user!.id, "Auto Role Added", `Role: ${roleId}`);
      res.json(autoRole);
    } catch {
      res.status(500).json({ error: "Failed to create auto role" });
    }
  });

  app.delete("/api/guilds/:guildId/auto-roles/:id", requireAuth, async (req, res) => {
    try {
      await client.db.autoRole.delete({ where: { id: parseInt(req.params['id']!) } });
      await logDashboardAction(req.params['guildId']!, req.session.user!.id, "Auto Role Removed", `ID: ${req.params['id']!}`);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete auto role" });
    }
  });

  // MODERATION API
  app.get("/api/guilds/:guildId/warns", requireAuth, async (req, res) => {
    try {
      const warns = await client.db.warn.findMany({
        where: { guildId: req.params['guildId']! },
        orderBy: { timestamp: "desc" },
        take: 100,
      });
      res.json(warns);
    } catch {
      res.status(500).json({ error: "Failed to fetch warns" });
    }
  });

  app.get("/api/guilds/:guildId/warns/:userId", requireAuth, async (req, res) => {
    try {
      const warns = await client.db.warn.findMany({
        where: { guildId: req.params['guildId']!, odbyUserId: req.params['userId']! },
        orderBy: { timestamp: "desc" },
      });
      const user = await client.users.fetch(req.params['userId']!).catch(() => null);
      res.json({ warns, user: user ? { id: user.id, username: user.username, avatar: user.avatar } : null });
    } catch {
      res.status(500).json({ error: "Failed to fetch warns" });
    }
  });

  app.delete("/api/guilds/:guildId/warns/:id", requireAuth, async (req, res) => {
    try {
      await client.db.warn.delete({ where: { id: parseInt(req.params['id']!) } });
      await logDashboardAction(req.params['guildId']!, req.session.user!.id, "Warn Removed", `ID: ${req.params['id']!}`);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete warn" });
    }
  });

  // LEADERBOARD API
  app.get("/api/guilds/:guildId/leaderboard", requireAuth, async (req, res) => {
    try {
      const users = await client.db.user.findMany({
        where: { visibleXp: true },
        orderBy: { xp: "desc" },
        take: 100,
      });

      const guild = client.guilds.cache.get(req.params['guildId']!);
      const leaderboard = await Promise.all(
        users
          .filter((u) => guild?.members.cache.has(u.id))
          .map(async (u, i) => {
            const member = guild?.members.cache.get(u.id);
            return {
              rank: i + 1,
              id: u.id,
              username: member?.user.username ?? "Unknown",
              avatar: member?.user.avatar,
              xp: u.xp,
              level: u.level,
            };
          })
      );

      res.json(leaderboard);
    } catch {
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  // EMBED TEMPLATES API
  app.get("/api/guilds/:guildId/embed-templates", requireAuth, async (req, res) => {
    try {
      const templates = await client.db.embedTemplate.findMany({ where: { guildId: req.params['guildId']! } });
      res.json(templates);
    } catch {
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  app.post("/api/guilds/:guildId/embed-templates", requireAuth, async (req, res) => {
    try {
      const { name, embed } = req.body;
      const template = await client.db.embedTemplate.create({
        data: { guildId: req.params['guildId']!, name, embed: JSON.stringify(embed) },
      });
      res.json(template);
    } catch {
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  app.delete("/api/guilds/:guildId/embed-templates/:id", requireAuth, async (req, res) => {
    try {
      await client.db.embedTemplate.delete({ where: { id: parseInt(req.params['id']!) } });
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete template" });
    }
  });

  // SEND MESSAGE API (Components V2)
  app.post("/api/send-embed", requireAuth, async (req, res) => {
    try {
      const { channelId, title, description, color, footer, image, buttons } = req.body;
      if (!channelId) return res.status(400).json({ error: "Missing channel" });

      const channel = client.channels.cache.get(channelId);
      if (!channel?.isTextBased() || channel.isDMBased()) return res.status(404).json({ error: "Channel not found" });

      const {
        ContainerBuilder,
        TextDisplayBuilder,
        SeparatorBuilder,
        SeparatorSpacingSize,
        MediaGalleryBuilder,
        MediaGalleryItemBuilder,
        ActionRowBuilder,
        ButtonBuilder,
        ButtonStyle,
        MessageFlags,
      } = await import("discord.js");

      const container = new ContainerBuilder();

      // Accent color
      if (color) container.setAccentColor(color);

      // Title
      if (title) {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`));
      }

      // Description
      if (description) {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(description));
      }

      // Image
      if (image) {
        container.addMediaGalleryComponents(
          new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(image))
        );
      }

      // Footer
      if (footer) {
        container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${footer}`));
      }

      // Buttons
      if (buttons?.length > 0) {
        const row = new ActionRowBuilder<any>();
        for (const btn of buttons.slice(0, 5)) {
          const button = new ButtonBuilder()
            .setLabel(btn.label || "Button")
            .setStyle(ButtonStyle[btn.style as keyof typeof ButtonStyle] || ButtonStyle.Primary);

          if (btn.url) button.setURL(btn.url);
          else button.setCustomId(`btn_${Date.now()}_${Math.random().toString(36).slice(2)}`);

          row.addComponents(button);
        }
        container.addActionRowComponents(row);
      }

      await (channel as any).send({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });

      const guild = (channel as any).guild;
      if (guild) {
        await logDashboardAction(guild.id, req.session.user!.id, "Message Sent", `Channel: #${channel.name}`);
      }

      res.json({ success: true });
    } catch (e) {
      logger.error("Failed to send dashboard embed:", e);
      res.status(500).json({ error: "Failed to send embed" });
    }
  });

  // DASHBOARD LOGS API
  app.get("/api/guilds/:guildId/dashboard-logs", requireAuth, async (req, res) => {
    try {
      const logs = await client.db.dashboardLog.findMany({
        where: { guildId: req.params['guildId']! },
        orderBy: { timestamp: "desc" },
        take: 100,
      });
      res.json(logs);
    } catch {
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  });

  // TICKET CATEGORIES API
  app.get("/api/guilds/:guildId/ticket-categories", requireAuth, async (req, res) => {
    try {
      const categories = await client.db.ticketCategory.findMany({ where: { guildId: req.params['guildId']! } });
      res.json(categories);
    } catch {
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.post("/api/guilds/:guildId/ticket-categories", requireAuth, async (req, res) => {
    try {
      const { name, emoji, description } = req.body;
      const category = await client.db.ticketCategory.create({
        data: { guildId: req.params['guildId']!, name, emoji: emoji || null, description: description || null },
      });
      await logDashboardAction(req.params['guildId']!, req.session.user!.id, "Ticket Category Created", `Name: ${name}`);
      res.json(category);
    } catch {
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  app.delete("/api/guilds/:guildId/ticket-categories/:id", requireAuth, async (req, res) => {
    try {
      await client.db.ticketCategory.delete({ where: { id: parseInt(req.params['id']!) } });
      await logDashboardAction(req.params['guildId']!, req.session.user!.id, "Ticket Category Deleted", `ID: ${req.params['id']!}`);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  // ===== TRANSCRIPT ROUTES =====
  app.get("/transcript/:id", requireAuth, async (req, res) => {
    try {
      const transcript = await client.db.transcript.findUnique({ where: { id: req.params['id']! } });
      if (!transcript) return res.status(404).send(errorPage("404", "Transcript not found."));

      const user = req.session.user!;
      const isOwner = transcript.userId === user.id;

      let isStaff = false;
      try {
        const guildsResponse = await fetch("https://discord.com/api/users/@me/guilds", {
          headers: { Authorization: `Bearer ${user.accessToken}` },
        });
        const guilds = await guildsResponse.json() as { id: string; permissions: string }[];
        const guild = guilds.find((g) => g.id === transcript.guildId);
        if (guild) {
          const permissions = BigInt(guild.permissions);
          isStaff = (permissions & BigInt(0x8)) !== BigInt(0) || (permissions & BigInt(0x20)) !== BigInt(0);
        }
      } catch {}

      if (!isOwner && !isStaff) return res.status(403).send(errorPage("403", "Access denied."));

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(transcript.html);
    } catch {
      res.status(500).send(errorPage("500", "Server Error"));
    }
  });

  app.get("/my-transcripts", requireAuth, async (req, res) => {
    const user = req.session.user!;
    const transcripts = await client.db.transcript.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.send(transcriptsPage(user, transcripts));
  });

  // ===== DASHBOARD PAGES =====
  app.get("/", (req, res) => res.redirect("/dashboard"));
  app.get("/dashboard", requireAuth, async (req, res) => res.send(dashboardPage(req.session.user!)));
  app.get("/dashboard/:guildId", requireAuth, async (req, res) => res.send(guildDashboardPage(req.session.user!, req.params['guildId']!)));
  app.get("/dashboard/:guildId/{*splat}", requireAuth, async (req, res) => res.send(guildDashboardPage(req.session.user!, req.params['guildId']!)));

  httpServer.listen(port, () => logger.info(`Web server started on port ${port}`));

  return { app, io, httpServer, aiNamespace };
}

// ===== HELPERS =====
async function verifyGuildAccess(accessToken: string, guildId: string, client: Bot): Promise<boolean> {
  try {
    const guildsResponse = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const guilds = await guildsResponse.json() as { id: string; permissions: string }[];
    const guild = guilds.find((g) => g.id === guildId);
    if (!guild) return false;
    const permissions = BigInt(guild.permissions);
    return (permissions & BigInt(0x8)) !== BigInt(0) || (permissions & BigInt(0x20)) !== BigInt(0);
  } catch {
    return false;
  }
}

async function getGuildStats(guildId: string, client: Bot): Promise<GuildStats> {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return { members: 0, online: 0, tickets: { open: 0, total: 0 }, messages24h: 0, voiceUsers: 0, boosts: 0 };

  const openTickets = await client.db.ticket.count({ where: { guildId, status: "open" } });
  const totalTickets = await client.db.ticket.count({ where: { guildId } });
  const voiceUsers = guild.members.cache.filter((m) => m.voice.channel).size;

  return {
    members: guild.memberCount,
    online: guild.members.cache.filter((m) => m.presence?.status && m.presence.status !== "offline").size,
    tickets: { open: openTickets, total: totalTickets },
    messages24h: 0,
    voiceUsers,
    boosts: guild.premiumSubscriptionCount ?? 0,
  };
}

// Import pages
import { homePage, dashboardPage, guildDashboardPage, transcriptsPage, errorPage } from "./pages/index.js";
