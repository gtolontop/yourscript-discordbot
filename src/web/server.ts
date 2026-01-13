import express from "express";
import session from "express-session";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import type { Bot } from "../client/Bot.js";
import { logger } from "../utils/index.js";

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

export function startWebServer(client: Bot, port: number = 3000) {
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
          .setAuthor({ name: "Dashboard Activity", iconURL: client.user?.displayAvatarURL() ?? undefined })
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

  // ===== AUTH ROUTES =====
  app.get("/auth/login", (req, res) => {
    const redirect = (req.query.redirect as string) || "/dashboard";
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
    const code = req.query.code as string;
    const state = req.query.state as string;
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

      const tokenData = await tokenResponse.json();
      if (!tokenData.access_token) return res.redirect(`/?error=token_failed`);

      const userResponse = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userData = await userResponse.json();

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
      const userGuilds = await guildsResponse.json();
      const botGuilds = client.guilds.cache;

      const accessibleGuilds = userGuilds
        .filter((g: any) => {
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
      const stats = await getGuildStats(req.params.guildId, client);
      res.json(stats);
    } catch {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get("/api/guilds/:guildId/channels", requireAuth, async (req, res) => {
    try {
      const guild = client.guilds.cache.get(req.params.guildId);
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
      const guild = client.guilds.cache.get(req.params.guildId);
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
      const guild = client.guilds.cache.get(req.params.guildId);
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
      const guild = client.guilds.cache.get(req.params.guildId);
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
      let config = await client.db.guild.findUnique({ where: { id: req.params.guildId } });
      if (!config) config = await client.db.guild.create({ data: { id: req.params.guildId } });
      res.json(config);
    } catch {
      res.status(500).json({ error: "Failed to fetch config" });
    }
  });

  app.put("/api/guilds/:guildId/config", requireAuth, async (req, res) => {
    try {
      const config = await client.db.guild.upsert({
        where: { id: req.params.guildId },
        update: req.body,
        create: { id: req.params.guildId, ...req.body },
      });
      await logDashboardAction(req.params.guildId, req.session.user!.id, "Config Updated", `Updated: ${Object.keys(req.body).join(", ")}`);
      res.json(config);
    } catch {
      res.status(500).json({ error: "Failed to update config" });
    }
  });

  // TICKETS API
  app.get("/api/guilds/:guildId/tickets", requireAuth, async (req, res) => {
    try {
      const { status, page = "1", limit = "50" } = req.query;
      const where: any = { guildId: req.params.guildId };
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
        where: { id: parseInt(req.params.ticketId), guildId: req.params.guildId },
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
        where: { id: parseInt(req.params.ticketId), guildId: req.params.guildId, status: "open" },
      });
      if (!ticket) return res.status(404).json({ error: "Ticket not found or already closed" });

      const { TicketService } = await import("../services/TicketService.js");
      const ticketService = new TicketService(client);
      const closer = await client.users.fetch(req.session.user!.id).catch(() => null);

      if (closer) {
        await ticketService.closeTicket(ticket, closer, req.body.reason);
        await logDashboardAction(req.params.guildId, req.session.user!.id, "Ticket Closed", `Closed ticket #${ticket.number}`);
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
        where: { guildId: req.params.guildId },
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
          guildId: req.params.guildId,
          channelId,
          messageId: msg.id,
          prize,
          winners,
          endsAt,
          hostId: req.session.user!.id,
          requiredRole: requiredRole || null,
        },
      });

      await logDashboardAction(req.params.guildId, req.session.user!.id, "Giveaway Created", `Prize: ${prize}, Winners: ${winners}`);
      res.json(giveaway);
    } catch {
      res.status(500).json({ error: "Failed to create giveaway" });
    }
  });

  app.delete("/api/guilds/:guildId/giveaways/:id", requireAuth, async (req, res) => {
    try {
      const giveaway = await client.db.giveaway.delete({ where: { id: parseInt(req.params.id) } });
      const channel = client.channels.cache.get(giveaway.channelId);
      if (channel?.isTextBased()) {
        const msg = await (channel as any).messages.fetch(giveaway.messageId).catch(() => null);
        if (msg) await msg.delete().catch(() => {});
      }
      await logDashboardAction(req.params.guildId, req.session.user!.id, "Giveaway Deleted", `Prize: ${giveaway.prize}`);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete giveaway" });
    }
  });

  app.post("/api/guilds/:guildId/giveaways/:id/reroll", requireAuth, async (req, res) => {
    try {
      const giveaway = await client.db.giveaway.findUnique({ where: { id: parseInt(req.params.id) } });
      if (!giveaway || !giveaway.ended) return res.status(400).json({ error: "Giveaway not found or not ended" });

      const participants = giveaway.participants as string[];
      if (participants.length === 0) return res.status(400).json({ error: "No participants" });

      const winner = participants[Math.floor(Math.random() * participants.length)];
      const channel = client.channels.cache.get(giveaway.channelId);
      if (channel?.isTextBased()) {
        await (channel as any).send(`🎉 New winner: <@${winner}>! Congratulations!`);
      }

      await logDashboardAction(req.params.guildId, req.session.user!.id, "Giveaway Rerolled", `Prize: ${giveaway.prize}`);
      res.json({ winner });
    } catch {
      res.status(500).json({ error: "Failed to reroll" });
    }
  });

  // REACTION ROLES API
  app.get("/api/guilds/:guildId/reaction-roles", requireAuth, async (req, res) => {
    try {
      const reactionRoles = await client.db.reactionRole.findMany({ where: { guildId: req.params.guildId } });
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
        emoji: r.emoji || undefined,
        description: r.description || undefined,
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
            guildId: req.params.guildId,
            channelId,
            messageId: msg.id,
            roleId: role.roleId,
            emoji: role.emoji || null,
          },
        });
      }

      await logDashboardAction(req.params.guildId, req.session.user!.id, "Reaction Roles Created", `${roles.length} roles in #${channel.name}`);
      res.json({ success: true, messageId: msg.id });
    } catch (e) {
      res.status(500).json({ error: "Failed to create reaction roles" });
    }
  });

  app.delete("/api/guilds/:guildId/reaction-roles/:messageId", requireAuth, async (req, res) => {
    try {
      const rrs = await client.db.reactionRole.findMany({ where: { messageId: req.params.messageId } });
      if (rrs.length > 0) {
        const channel = client.channels.cache.get(rrs[0].channelId);
        if (channel?.isTextBased()) {
          const msg = await (channel as any).messages.fetch(req.params.messageId).catch(() => null);
          if (msg) await msg.delete().catch(() => {});
        }
        await client.db.reactionRole.deleteMany({ where: { messageId: req.params.messageId } });
      }
      await logDashboardAction(req.params.guildId, req.session.user!.id, "Reaction Roles Deleted", `Message: ${req.params.messageId}`);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete reaction roles" });
    }
  });

  // AUTO ROLES API
  app.get("/api/guilds/:guildId/auto-roles", requireAuth, async (req, res) => {
    try {
      const autoRoles = await client.db.autoRole.findMany({ where: { guildId: req.params.guildId } });
      res.json(autoRoles);
    } catch {
      res.status(500).json({ error: "Failed to fetch auto roles" });
    }
  });

  app.post("/api/guilds/:guildId/auto-roles", requireAuth, async (req, res) => {
    try {
      const { roleId, type, delay } = req.body;
      const autoRole = await client.db.autoRole.create({
        data: { guildId: req.params.guildId, roleId, type: type || "join", delay: delay || 0 },
      });
      await logDashboardAction(req.params.guildId, req.session.user!.id, "Auto Role Added", `Role: ${roleId}`);
      res.json(autoRole);
    } catch {
      res.status(500).json({ error: "Failed to create auto role" });
    }
  });

  app.delete("/api/guilds/:guildId/auto-roles/:id", requireAuth, async (req, res) => {
    try {
      await client.db.autoRole.delete({ where: { id: parseInt(req.params.id) } });
      await logDashboardAction(req.params.guildId, req.session.user!.id, "Auto Role Removed", `ID: ${req.params.id}`);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete auto role" });
    }
  });

  // MODERATION API
  app.get("/api/guilds/:guildId/warns", requireAuth, async (req, res) => {
    try {
      const warns = await client.db.warn.findMany({
        where: { guildId: req.params.guildId },
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
        where: { guildId: req.params.guildId, odbyUserId: req.params.userId },
        orderBy: { timestamp: "desc" },
      });
      const user = await client.users.fetch(req.params.userId).catch(() => null);
      res.json({ warns, user: user ? { id: user.id, username: user.username, avatar: user.avatar } : null });
    } catch {
      res.status(500).json({ error: "Failed to fetch warns" });
    }
  });

  app.delete("/api/guilds/:guildId/warns/:id", requireAuth, async (req, res) => {
    try {
      await client.db.warn.delete({ where: { id: parseInt(req.params.id) } });
      await logDashboardAction(req.params.guildId, req.session.user!.id, "Warn Removed", `ID: ${req.params.id}`);
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

      const guild = client.guilds.cache.get(req.params.guildId);
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
      const templates = await client.db.embedTemplate.findMany({ where: { guildId: req.params.guildId } });
      res.json(templates);
    } catch {
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  app.post("/api/guilds/:guildId/embed-templates", requireAuth, async (req, res) => {
    try {
      const { name, embed } = req.body;
      const template = await client.db.embedTemplate.create({
        data: { guildId: req.params.guildId, name, embed: JSON.stringify(embed) },
      });
      res.json(template);
    } catch {
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  app.delete("/api/guilds/:guildId/embed-templates/:id", requireAuth, async (req, res) => {
    try {
      await client.db.embedTemplate.delete({ where: { id: parseInt(req.params.id) } });
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
        const row = new ActionRowBuilder<ButtonBuilder>();
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
      console.error(e);
      res.status(500).json({ error: "Failed to send embed" });
    }
  });

  // DASHBOARD LOGS API
  app.get("/api/guilds/:guildId/dashboard-logs", requireAuth, async (req, res) => {
    try {
      const logs = await client.db.dashboardLog.findMany({
        where: { guildId: req.params.guildId },
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
      const categories = await client.db.ticketCategory.findMany({ where: { guildId: req.params.guildId } });
      res.json(categories);
    } catch {
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.post("/api/guilds/:guildId/ticket-categories", requireAuth, async (req, res) => {
    try {
      const { name, emoji, description } = req.body;
      const category = await client.db.ticketCategory.create({
        data: { guildId: req.params.guildId, name, emoji: emoji || null, description: description || null },
      });
      await logDashboardAction(req.params.guildId, req.session.user!.id, "Ticket Category Created", `Name: ${name}`);
      res.json(category);
    } catch {
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  app.delete("/api/guilds/:guildId/ticket-categories/:id", requireAuth, async (req, res) => {
    try {
      await client.db.ticketCategory.delete({ where: { id: parseInt(req.params.id) } });
      await logDashboardAction(req.params.guildId, req.session.user!.id, "Ticket Category Deleted", `ID: ${req.params.id}`);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  // ===== TRANSCRIPT ROUTES =====
  app.get("/transcript/:id", requireAuth, async (req, res) => {
    try {
      const transcript = await client.db.transcript.findUnique({ where: { id: req.params.id } });
      if (!transcript) return res.status(404).send(errorPage("404", "Transcript non trouvé."));

      const user = req.session.user!;
      const isOwner = transcript.userId === user.id;

      let isStaff = false;
      try {
        const guildsResponse = await fetch("https://discord.com/api/users/@me/guilds", {
          headers: { Authorization: `Bearer ${user.accessToken}` },
        });
        const guilds = await guildsResponse.json();
        const guild = guilds.find((g: any) => g.id === transcript.guildId);
        if (guild) {
          const permissions = BigInt(guild.permissions);
          isStaff = (permissions & BigInt(0x8)) !== BigInt(0) || (permissions & BigInt(0x20)) !== BigInt(0);
        }
      } catch {}

      if (!isOwner && !isStaff) return res.status(403).send(errorPage("403", "Accès refusé."));

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(transcript.html);
    } catch {
      res.status(500).send(errorPage("500", "Erreur serveur"));
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
  app.get("/dashboard/:guildId", requireAuth, async (req, res) => res.send(guildDashboardPage(req.session.user!, req.params.guildId)));
  app.get("/dashboard/:guildId/{*splat}", requireAuth, async (req, res) => res.send(guildDashboardPage(req.session.user!, req.params.guildId)));

  httpServer.listen(port, () => logger.info(`Web server started on port ${port}`));

  return { app, io, httpServer };
}

// ===== HELPERS =====
async function verifyGuildAccess(accessToken: string, guildId: string, client: Bot): Promise<boolean> {
  try {
    const guildsResponse = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const guilds = await guildsResponse.json();
    const guild = guilds.find((g: any) => g.id === guildId);
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
