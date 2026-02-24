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

bridge.onQuery("query:generateEmbed", async (data: any) => {
  try {
    const prompt = data.prompt;
    const result = await ai.generateText(
      "You are a specialized Discord message generator. Based on the user's prompt, create a beautifully formatted message targeting a clean V2 style layout. Respond ONLY with a valid JSON object matching this structure: {\n  \"title\": \"Short catchy title\",\n  \"description\": \"Detailed description, use markdown, emojis, line breaks\",\n  \"color\": \"#ff0000\", // A hex color fitting the theme\n  \"footer\": \"Optional footer text\",\n  \"fields\": [ { \"name\": \"Field Name\", \"value\": \"Field Value\" } ] // Optional array of fields\n}. Do not include any markdown blocks around the JSON.",
      [{ role: "user", content: prompt }],
      { temperature: 0.7, maxTokens: 800, taskType: "classification" }
    );
    
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { error: "Failed to parse JSON from AI response." };
    
    return { embed: JSON.parse(jsonMatch[0]) };
  } catch (err: any) {
    logger.error("Error generating embed:", err);
    return { error: err.message };
  }
});

bridge.onQuery("query:modifyEmbed", async (data: any) => {
  try {
    const { prompt, currentEmbedData } = data;
    const result = await ai.generateText(
      "You are a specialized Discord message generator. You are given a user's instruction to modify an existing JSON embed configuration. Respond ONLY with a FULL valid JSON object incorporating the changes, matching this structure: {\n  \"title\": \"Short catchy title\",\n  \"description\": \"Detailed description, use markdown, emojis, line breaks\",\n  \"color\": \"#ff0000\", // A hex color fitting the theme\n  \"footer\": \"Optional footer text\",\n  \"fields\": [ { \"name\": \"Field Name\", \"value\": \"Field Value\" } ] // Optional array of fields\n}. You MUST provide the full JSON, not just the diff. Do not include any markdown blocks around the JSON.",
      [
        { role: "model", content: JSON.stringify(currentEmbedData) },
        { role: "user", content: prompt }
      ],
      { temperature: 0.7, maxTokens: 800, taskType: "classification" }
    );
    
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { error: "Failed to parse JSON from AI response." };
    
    return { embed: JSON.parse(jsonMatch[0]) };
  } catch (err: any) {
    logger.error("Error modifying embed:", err);
    return { error: err.message };
  }
});

bridge.onQuery("query:generateMoraleReport", async (data: any) => {
  try {
    const ticketData = data.data;
    if (!ticketData) return { text: "No tickets were closed yesterday." };

    const result = await ai.generateText(
      "You are analyzing a day of customer support tickets for a FiveM server. Based on the provided summary of yesterday's tickets, write a short, sharp paragraph (3-4 sentences) summarizing the 'Server Morale' for the staff team. Mention trends, overall sentiment (e.g. 80% positive), and highlight any recurring frustrations or bugs. Be concise and professional.",
      [{ role: "user", content: ticketData }],
      { temperature: 0.3, maxTokens: 200, taskType: "classification" } 
    );
    
    return { text: result.text.trim() };
  } catch (err: any) {
    logger.error("Error generating morale report:", err);
    return { error: err.message };
  }
});

bridge.onQuery("query:generateWeeklyFAQ", async (data: any) => {
  try {
    const ticketData = data.data;
    if (!ticketData) return { text: "No tickets to analyze." };

    const result = await ai.generateText(
      "You are analyzing a week of customer support tickets. Based on these summaries, generate 3 clear Question & Answer pairs that should be added to the server's public FAQ to prevent future tickets. Format them clearly with Q: and A:. Focus on the most common or easily resolvable issues mentioned.",
      [{ role: "user", content: ticketData }],
      { temperature: 0.4, maxTokens: 400, taskType: "classification" } 
    );
    
    return { text: result.text.trim() };
  } catch (err: any) {
    logger.error("Error generating weekly FAQ:", err);
    return { error: err.message };
  }
});

bridge.onQuery("query:generateHandover", async (data: any) => {
  try {
    const ticketData = data.data;
    if (!ticketData) return { text: "No tickets to analyze." };

    const result = await ai.generateText(
      "You are an assistant for a FiveM support team. A staff member is logging off and requested a 'Shift Handover' summary. Based on the provided list of currently active tickets, write a concise, organized summary so the next shift knows what needs attention. Use markdown lists and bullet points.",
      [{ role: "user", content: ticketData }],
      { temperature: 0.3, maxTokens: 400, taskType: "classification" } 
    );
    
    return { text: result.text.trim() };
  } catch (err: any) {
    logger.error("Error generating handover:", err);
    return { error: err.message };
  }
});

bridge.onQuery("query:generateStaffReport", async (data: any) => {
  try {
    const ticketData = data.data;
    if (!ticketData) return { text: "No closed tickets to analyze." };

    const result = await ai.generateText(
      "You are an AI generating a monthly staff performance report for a FiveM server. Based on this list of closed tickets (ClaimedBy, Rating, Sentiment), write a short performance summary (3-4 paragraphs) highlighting which staff members did well, who resolved the most, and general satisfaction. Keep it professional and constructive.",
      [{ role: "user", content: ticketData }],
      { temperature: 0.3, maxTokens: 500, taskType: "classification" } 
    );
    
    return { text: result.text.trim() };
  } catch (err: any) {
    logger.error("Error generating staff report:", err);
    return { error: err.message };
  }
});

bridge.onQuery("query:generateLearning", async (data: any) => {
  try {
    const rawText = data.text;
    if (!rawText) return { error: "No text provided." };

    const result = await ai.generateText(
      "You are a Knowledge Base formatter for an AI assistant. The user will provide raw text facts, rules, or product info. You must strictly output JSON matching exactly this object: {\"category\": \"business\" | \"glossary\" | \"instructions\" | \"faq\" | \"product\", \"key\": \"short_unique_key\", \"value\": \"Cleaned and formatted content to add to the permanent system prompt.\"}. Respond ONLY with valid JSON and NO markdown blocks.",
      [{ role: "user", content: rawText }],
      { temperature: 0.1, maxTokens: 400, taskType: "classification" } 
    );
    
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { error: "Failed to parse JSON from AI response." };
    
    return { data: JSON.parse(jsonMatch[0]) };
  } catch (err: any) {
    logger.error("Error generating learning info:", err);
    return { error: err.message };
  }
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
