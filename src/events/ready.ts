import { ActivityType, ChannelType, OAuth2Scopes, PermissionFlagsBits, REST, Routes } from "discord.js";
import { joinVoiceChannel } from "@discordjs/voice";
import type { Event } from "../types/index.js";
import { logger } from "../utils/index.js";
import { processRoleAllJob } from "../commands/admin/roleall.js";
import { TicketService } from "../services/TicketService.js";
import { startGiveawayScheduler } from "../commands/admin/giveaway.js";
import { startWebServer } from "../web/server.js";

const event: Event<"clientReady"> = {
  name: "clientReady",
  once: true,
  async execute(client) {
    logger.info(`Logged in as ${client.user?.tag}`);
    logger.info(`Serving ${client.guilds.cache.size} guilds`);

    // Auto-deploy slash commands
    try {
      const commands = client.commands.map((cmd) => cmd.data.toJSON());
      const rest = new REST().setToken(client.token!);

      await rest.put(Routes.applicationCommands(client.user!.id), {
        body: commands,
      });

      logger.info(`Deployed ${commands.length} slash commands`);
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

    client.user?.setActivity({
      name: "ton serveur",
      type: ActivityType.Watching,
    });

    // Start ticket auto-close scheduler
    const ticketService = new TicketService(client);
    ticketService.startAutoCloseScheduler();
    logger.info("Ticket auto-close scheduler started");

    // Start giveaway scheduler
    await startGiveawayScheduler(client);
    logger.info("Giveaway scheduler started");

    // Start web server for transcripts
    const webPort = parseInt(process.env.WEB_PORT ?? "3000");
    startWebServer(client, webPort);
  },
};

export default event;
