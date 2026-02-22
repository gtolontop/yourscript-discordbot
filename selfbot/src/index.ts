import "dotenv/config";
import { SelfBotClient } from "./client/SelfBotClient.js";
import { BotBridge } from "./bridge/BotBridge.js";
import { OpenRouterProvider } from "./ai/openrouter.js";
import { BudgetMonitor, type AlertLevel } from "./ai/budget.js";
import { ModelRouter } from "./ai/router.js";
import { ActionParser } from "./ai/actionParser.js";
import { TicketHandler } from "./handlers/ticketHandler.js";
import { DMHandler } from "./handlers/dmHandler.js";
import { ReviewHandler } from "./handlers/reviewHandler.js";
import { ReportService } from "./services/reportService.js";
import { logger } from "./utils/logger.js";

// Validate required env vars
const SELFBOT_TOKEN = process.env["SELFBOT_TOKEN"];
const OPENROUTER_API_KEY = process.env["OPENROUTER_API_KEY"];
const AI_SECRET = process.env["AI_SECRET"];
const BOT_SERVER_URL = process.env["BOT_SERVER_URL"] ?? "http://localhost:3000";
const AI_DAILY_BUDGET = parseFloat(process.env["AI_DAILY_BUDGET"] ?? "5");
const AI_BUDGET_ALERT_CHANNEL = process.env["AI_BUDGET_ALERT_CHANNEL"];

if (!SELFBOT_TOKEN) {
  logger.error("SELFBOT_TOKEN is required");
  process.exit(1);
}
if (!OPENROUTER_API_KEY) {
  logger.error("OPENROUTER_API_KEY is required");
  process.exit(1);
}
if (!AI_SECRET) {
  logger.error("AI_SECRET is required");
  process.exit(1);
}

// Initialize components
const selfbot = new SelfBotClient();
const bridge = new BotBridge(BOT_SERVER_URL, AI_SECRET);

// Budget monitor with Discord alert callbacks
const budget = new BudgetMonitor({
  dailyLimitUsd: AI_DAILY_BUDGET,
  onAlert: (level: AlertLevel, spend: number, limit: number) => {
    if (!AI_BUDGET_ALERT_CHANNEL) return;
    const colors: Record<AlertLevel, number> = {
      yellow: 0xffff00,
      orange: 0xff8c00,
      red: 0xff0000,
      hard_stop: 0x8b0000,
    };
    bridge.sendAsBot({
      channelId: AI_BUDGET_ALERT_CHANNEL,
      embed: {
        title: `Budget Alert: ${level.toUpperCase()}`,
        description: `AI spending: **$${spend.toFixed(4)}** / $${limit.toFixed(2)} (${((spend / limit) * 100).toFixed(1)}%)`,
        color: colors[level] ?? 0xffff00,
        footer: `Daily limit: $${limit}`,
      },
    }).catch(() => {});
  },
  onHardStop: (spend: number, limit: number) => {
    logger.error(`BUDGET HARD STOP REACHED: $${spend.toFixed(4)} / $${limit}`);
    if (!AI_BUDGET_ALERT_CHANNEL) return;
    bridge.sendAsBot({
      channelId: AI_BUDGET_ALERT_CHANNEL,
      embed: {
        title: "BUDGET HARD STOP - AI DISABLED",
        description: `Daily budget exceeded: **$${spend.toFixed(4)}** / $${limit.toFixed(2)}\nAll AI requests are blocked until midnight.`,
        color: 0x8b0000,
        footer: "Increase AI_DAILY_BUDGET or wait for reset",
      },
    }).catch(() => {});
  },
  onTrack: (data) => {
    bridge.trackAICost(data).catch(() => {});
  },
});

const ai = new OpenRouterProvider(OPENROUTER_API_KEY, budget);
const router = new ModelRouter();
const actionParser = new ActionParser(ai);

// Initialize handlers
const ticketHandler = new TicketHandler(selfbot, bridge, ai, router, actionParser);
const dmHandler = new DMHandler(selfbot, bridge, ai, router, actionParser);
const reviewHandler = new ReviewHandler(bridge);
const reportService = new ReportService(bridge, budget, ticketHandler, dmHandler);

// Register bridge event handlers
bridge.on("ticket:new", (data) => ticketHandler.handleNewTicket(data));
bridge.on("ticket:message", (data) => ticketHandler.handleTicketMessage(data));
bridge.on("ticket:close", (data) => ticketHandler.handleTicketClose(data));
bridge.on("review:submitted", (data) => reviewHandler.handleReview(data));
bridge.on("dm:threadReply", (data) => dmHandler.handleStaffThreadReply(data));

// Handle fired reminders (DM reminders from bot server)
bridge.on("reminder:fire", async (data) => {
  try {
    const user = await selfbot.users.fetch(data.userId);
    const dmChannel = await user.createDM();
    await dmChannel.send(`**Reminder:** ${data.content}`);
    logger.dm(`Reminder sent to ${data.userId}: ${data.content}`);
  } catch (err) {
    logger.error(`Failed to send reminder DM to ${data.userId}:`, err);
  }
});

// Register DM and thread message handlers on the selfbot
selfbot.onDirectMessage((msg) => dmHandler.handleDM(msg));
selfbot.onThreadMessage((msg) => dmHandler.handleThreadMessage(msg));

// Register query handlers (server asks selfbot to generate summaries)
bridge.onQuery("query:generateSummary", async (data: any) => {
  const sentimentData = ticketHandler.getSentimentTemperature(data.channelId);
  const result = await ai.summarizeTicket(
    data.previousSummary,
    data.messages,
    sentimentData ?? undefined,
    { ticketId: data.channelId, guildId: data.guildId }
  );
  return {
    summary: result.summary,
    keyPoints: result.keyPoints,
    suggestions: result.suggestions,
    sentiment: result.sentiment,
    trend: sentimentData?.trend ?? "stable",
  };
});

// Start everything
async function main() {
  logger.info("Starting AI Selfbot...");
  logger.info(`Budget: $${AI_DAILY_BUDGET}/day`);

  // Connect selfbot to Discord
  await selfbot.start(SELFBOT_TOKEN!);

  // Connect bridge to bot server
  bridge.connect();

  // Start report service
  reportService.start();

  logger.info("AI Selfbot is running (OpenRouter)");
  logger.info(`Bridge target: ${BOT_SERVER_URL}/ai`);
  if (process.env["AI_DM_LOG_CHANNEL"]) {
    logger.info(`DM logging enabled: ${process.env["AI_DM_LOG_CHANNEL"]}`);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Shutting down...");
  reportService.stop();
  dmHandler.stop();
  bridge.disconnect();
  await selfbot.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down...");
  reportService.stop();
  dmHandler.stop();
  bridge.disconnect();
  await selfbot.stop();
  process.exit(0);
});

main().catch((err) => {
  logger.error("Fatal error:", err);
  process.exit(1);
});
