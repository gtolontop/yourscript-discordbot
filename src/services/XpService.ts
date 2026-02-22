import { Message, TextChannel, EmbedBuilder } from "discord.js";
import type { Bot } from "../client/Bot.js";
import { logger, Colors } from "../utils/index.js";

export class XpService {
  private lastMessageMap = new Map<string, number>();

  constructor(private client: Bot) {}

  public async handleMessage(message: Message) {
    if (!message.guild || message.author.bot) return;

    const guildId = message.guild.id;
    const userId = message.author.id;

    // Fetch guild config to check constraints
    const config = await this.client.db.guild.findUnique({
      where: { id: guildId },
    }) as any;

    if (!config) return;

    // Respect Cooldown
    const cooldownMs = (config.xpCooldown ?? 60) * 1000;
    const lastMsgTime = this.lastMessageMap.get(userId) ?? 0;
    const now = Date.now();

    if (now - lastMsgTime < cooldownMs) return;
    this.lastMessageMap.set(userId, now);

    // Calculate XP
    const minXp = config.xpMin ?? 15;
    const maxXp = config.xpMax ?? 25;
    const xpGained = Math.floor(Math.random() * (maxXp - minXp + 1)) + minXp;

    // Get or Create User
    let user = await this.client.db.user.findUnique({ where: { id: userId } }) as any;
    if (!user) {
      user = await (this.client.db as any).user.create({
        data: {
          id: userId,
          xp: xpGained,
          level: 0,
        },
      });
    } else {
      user = await (this.client.db as any).user.update({
        where: { id: userId },
        data: { xp: { increment: xpGained } },
      });
    }

    // Check for level up
    // Simple scaling algorithm: Math.floor(0.1 * Math.sqrt(xp))
    // Meaning level 1 requires 100 xp, level 2 req 400 xp, level 5 req 2500 xp, etc.
    const expectedLevel = Math.floor(0.1 * Math.sqrt(user.xp));

    if (expectedLevel > user.level) {
      // User leveled up
      await (this.client.db as any).user.update({
        where: { id: userId },
        data: { level: expectedLevel },
      });

      // Send Level Up Announcement
      if (config.levelUpChannel && config.levelUpMessage) {
        const channel = message.guild.channels.cache.get(config.levelUpChannel) as TextChannel;
        if (channel) {
          const announcement = config.levelUpMessage
            .replace(/{user}/g, message.author.toString())
            .replace(/{level}/g, expectedLevel.toString());
          
          await channel.send(announcement).catch(() => {});
        }
      }

      // Check for Role Rewards
      await this.grantLevelRoles(message, expectedLevel, guildId);

      // Check for Store Credit / Tebex Integration (if configured)
      // For now, emit event or log it for manual/automated handling
      logger.info(`User ${message.author.tag} leveled up to ${expectedLevel} in ${message.guild.name}`);
    }
  }

  private async grantLevelRoles(message: Message, newLevel: number, guildId: string) {
    const levelRoles = await (this.client.db as any).levelRole.findMany({
      where: { guildId },
    });

    const rolesToAdd = levelRoles
      .filter((lr: any) => lr.level <= newLevel)
      .map((lr: any) => lr.roleId);

    if (rolesToAdd.length > 0 && message.member) {
      const existingRoles = [ ...message.member.roles.cache.keys() ];
      const missingRoles = rolesToAdd.filter((id: string) => !existingRoles.includes(id));

      if (missingRoles.length > 0) {
        await message.member.roles.add(missingRoles).catch((err) => {
          logger.warn(`Failed to add level role to ${message.author.tag}: ${err.message}`);
        });
      }
    }
  }
}
