import type { BotBridge } from "../bridge/BotBridge.js";
import type { BudgetMonitor } from "../ai/budget.js";
import type { TicketHandler } from "../handlers/ticketHandler.js";
import type { DMHandler } from "../handlers/dmHandler.js";
import { logger } from "../utils/logger.js";

const SIX_HOURS = 6 * 60 * 60 * 1000;

export class ReportService {
  private reportInterval: ReturnType<typeof setInterval> | null = null;
  private midnightTimeout: ReturnType<typeof setTimeout> | null = null;
  private alertChannelId: string;

  constructor(
    private bridge: BotBridge,
    private budget: BudgetMonitor,
    private ticketHandler: TicketHandler,
    private dmHandler?: DMHandler
  ) {
    this.alertChannelId = process.env["AI_BUDGET_ALERT_CHANNEL"] ?? "";
  }

  start(): void {
    // Send report every 6 hours
    this.reportInterval = setInterval(() => this.sendReport(), SIX_HOURS);

    // Schedule midnight save
    this.scheduleMidnight();

    logger.info("ReportService started (reports every 6h)");
  }

  stop(): void {
    if (this.reportInterval) {
      clearInterval(this.reportInterval);
      this.reportInterval = null;
    }
    if (this.midnightTimeout) {
      clearTimeout(this.midnightTimeout);
      this.midnightTimeout = null;
    }
  }

  async sendReport(): Promise<void> {
    if (!this.alertChannelId || !this.bridge.connected) return;

    try {
      const summary = this.budget.getDaySummary();
      const activeTickets = this.ticketHandler.getActiveCount();
      const activeDMs = this.dmHandler?.getActiveDMCount() ?? 0;

      const modelLines = Object.entries(summary.byModel)
        .map(([model, data]) => `${model}: ${data.requests} reqs, $${data.cost.toFixed(4)}`)
        .join("\n") || "None";

      const taskLines = Object.entries(summary.byTaskType)
        .map(([type, data]) => `${type}: ${data.requests} reqs, $${data.cost.toFixed(4)}`)
        .join("\n") || "None";

      await this.bridge.sendAsBot({
        channelId: this.alertChannelId,
        embed: {
          title: "AI Report",
          description: [
            `**Date:** ${summary.date}`,
            `**Total Spend:** $${summary.totalSpend.toFixed(4)}`,
            `**Total Requests:** ${summary.totalRequests}`,
            `**Tokens:** ${summary.totalTokensIn.toLocaleString()} in / ${summary.totalTokensOut.toLocaleString()} out (${summary.totalCached.toLocaleString()} cached)`,
            `**Avg Cost/Ticket:** $${summary.avgCostPerTicket.toFixed(4)}`,
            "",
            `**Active Tickets:** ${activeTickets}`,
            `**Active DMs:** ${activeDMs}`,
            "",
            `**By Model:**\n\`\`\`${modelLines}\`\`\``,
            `**By Task:**\n\`\`\`${taskLines}\`\`\``,
          ].join("\n"),
          color: 0x5865f2,
          footer: "Auto-report (every 6h)",
        },
      });

      logger.info("AI report sent successfully");
    } catch (err) {
      logger.error("Failed to send AI report:", err);
    }
  }

  private scheduleMidnight(): void {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = midnight.getTime() - now.getTime();

    this.midnightTimeout = setTimeout(async () => {
      await this.saveDaySummary();
      // Reschedule for next midnight
      this.scheduleMidnight();
    }, msUntilMidnight);
  }

  private async saveDaySummary(): Promise<void> {
    try {
      const summary = this.budget.getDaySummary();
      await this.bridge.saveDaySummary({
        date: summary.date,
        totalSpend: summary.totalSpend,
        totalRequests: summary.totalRequests,
        totalTokensIn: summary.totalTokensIn,
        totalTokensOut: summary.totalTokensOut,
        totalCached: summary.totalCached,
        avgCostPerTicket: summary.avgCostPerTicket,
        byModel: JSON.stringify(summary.byModel),
        byTaskType: JSON.stringify(summary.byTaskType),
      });
      logger.info(`Day summary saved for ${summary.date}`);
    } catch (err) {
      logger.error("Failed to save day summary:", err);
    }
  }
}
