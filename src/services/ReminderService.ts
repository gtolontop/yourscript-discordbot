import type { Bot } from "../client/Bot.js";
import { logger } from "../utils/index.js";

export class ReminderService {
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(private client: Bot) {}

  start(): void {
    // Check for due reminders every 30 seconds
    this.interval = setInterval(() => this.checkReminders(), 30_000);
    logger.info("ReminderService started (checking every 30s)");
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async checkReminders(): Promise<void> {
    try {
      const now = new Date();

      const dueReminders = await this.client.db.aIReminder.findMany({
        where: {
          triggerAt: { lte: now },
          fired: false,
        },
        take: 20,
      });

      if (dueReminders.length === 0) return;

      for (const reminder of dueReminders) {
        try {
          if (reminder.channelId) {
            // Send to channel
            const channel = this.client.channels.cache.get(reminder.channelId);
            if (channel?.isTextBased() && !channel.isDMBased()) {
              const { EmbedBuilder } = await import("discord.js");
              const embed = new EmbedBuilder()
                .setTitle("Reminder")
                .setDescription(reminder.content)
                .setColor(0x5865f2)
                .setTimestamp()
                .setFooter({ text: `Reminder for ${reminder.targetUserId ? `<@${reminder.targetUserId}>` : `<@${reminder.userId}>`}` });

              const mention = reminder.targetUserId
                ? `<@${reminder.targetUserId}>`
                : `<@${reminder.userId}>`;

              await (channel as any).send({
                content: mention,
                embeds: [embed],
              });
            }
          } else {
            // DM reminder - emit to AI namespace so selfbot can send it
            if (this.client.aiNamespace) {
              this.client.aiNamespace.emit("reminder:fire" as any, {
                reminderId: reminder.id,
                userId: reminder.targetUserId ?? reminder.userId,
                content: reminder.content,
                channelId: reminder.channelId,
              });
            }
          }

          // Mark as fired
          await this.client.db.aIReminder.update({
            where: { id: reminder.id },
            data: { fired: true },
          });

          logger.info(`Reminder #${reminder.id} fired for user ${reminder.userId}`);
        } catch (err) {
          logger.error(`Failed to fire reminder #${reminder.id}:`, err);
        }
      }
    } catch (err) {
      logger.error("ReminderService check failed:", err);
    }
  }
}
