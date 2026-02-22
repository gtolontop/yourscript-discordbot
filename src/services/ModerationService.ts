import { type Guild, type User } from "discord.js";
import type { Bot } from "../client/Bot.js";
import { LogService } from "./LogService.js";

export class ModerationService {
  private logService: LogService;

  constructor(private client: Bot) {
    this.logService = new LogService(client);
  }

  /**
   * Get or create guild config
   */
  async getGuildConfig(guildId: string) {
    let config = await this.client.db.guild.findUnique({
      where: { id: guildId },
    });

    if (!config) {
      config = await this.client.db.guild.create({
        data: { id: guildId },
      });
    }

    return config;
  }

  /**
   * Log a ban action
   */
  async logBan(guild: Guild, target: User, moderator: User, reason?: string) {
    await this.logService.logBan(guild, target, moderator, reason);
  }

  /**
   * Log an unban action
   */
  async logUnban(guild: Guild, target: User, moderator: User) {
    await this.logService.logUnban(guild, target, moderator);
  }

  /**
   * Log a kick action
   */
  async logKick(guild: Guild, target: User, moderator: User, reason?: string) {
    await this.logService.logKick(guild, target, moderator, reason);
  }

  /**
   * Log a mute action
   */
  async logMute(guild: Guild, target: User, moderator: User, duration: string, reason?: string) {
    await this.logService.logMute(guild, target, moderator, duration, reason);
  }

  /**
   * Log an unmute action
   */
  async logUnmute(guild: Guild, target: User, moderator: User) {
    await this.logService.logUnmute(guild, target, moderator);
  }

  /**
   * Log a warn action
   */
  async logWarn(guild: Guild, target: User, moderator: User, reason: string, warnCount: number) {
    await this.logService.logWarn(guild, target, moderator, reason, warnCount);
  }

  /**
   * Log a clear action
   */
  async logClear(guild: Guild, moderator: User, count: number, channelId: string, targetUser?: User) {
    await this.logService.logClear(guild, moderator, count, channelId, targetUser);
  }

  /**
   * Add a warn to a user
   */
  async addWarn(userId: string, guildId: string, moderatorId: string, reason: string) {
    // Ensure user exists
    await this.client.db.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
    });

    const warn = await this.client.db.warn.create({
      data: {
        userId,
        guildId,
        odbyUserId: userId,
        odByModId: moderatorId,
        reason,
      },
    });

    return warn;
  }

  /**
   * Get all warns for a user in a guild
   */
  async getWarns(userId: string, guildId: string) {
    return this.client.db.warn.findMany({
      where: { userId, guildId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Delete a specific warn
   */
  async deleteWarn(warnId: number) {
    return this.client.db.warn.delete({
      where: { id: warnId },
    });
  }

  /**
   * Clear all warns for a user in a guild
   */
  async clearWarns(userId: string, guildId: string) {
    return this.client.db.warn.deleteMany({
      where: { userId, guildId },
    });
  }

  /**
   * Get warn count for a user
   */
  async getWarnCount(userId: string, guildId: string) {
    return this.client.db.warn.count({
      where: { userId, guildId },
    });
  }
}
