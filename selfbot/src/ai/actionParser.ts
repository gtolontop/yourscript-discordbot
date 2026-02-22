import type { OpenRouterProvider } from "./openrouter.js";
import type { AIMessage } from "./provider.js";
import { logger } from "../utils/logger.js";

export interface TodoData {
  title: string;
  description?: string;
  priority: "low" | "normal" | "high" | "urgent";
  assigneeHint?: string;
}

export interface ReminderData {
  content: string;
  delayMs: number;
  targetSelf: boolean;
}

export interface EscalateData {
  reason: string;
  specialtyNeeded?: string;
}

export interface DetectedAction {
  type: "todo" | "reminder" | "escalate" | "assign_role" | "close";
  confidence: number;
  data: TodoData | ReminderData | EscalateData;
}

export class ActionParser {
  constructor(private ai: OpenRouterProvider) {}

  async detectActions(
    conversationHistory: AIMessage[],
    latestAIResponse: string,
    context: { channelId: string; guildId: string; userId: string; ticketType?: string }
  ): Promise<DetectedAction[]> {
    // Only analyze if the response suggests an action
    const lower = latestAIResponse.toLowerCase();
    const hasActionHint =
      lower.includes("note") ||
      lower.includes("créer") ||
      lower.includes("create") ||
      lower.includes("rappel") ||
      lower.includes("remind") ||
      lower.includes("todo") ||
      lower.includes("task") ||
      lower.includes("escalat") ||
      lower.includes("equipe") ||
      lower.includes("team") ||
      lower.includes("fermer") ||
      lower.includes("close") ||
      lower.includes("demain") ||
      lower.includes("tomorrow") ||
      lower.includes("plus tard") ||
      lower.includes("later") ||
      lower.includes("heure") ||
      lower.includes("hour") ||
      lower.includes("minute") ||
      lower.includes("manager") ||
      lower.includes("someone") ||
      lower.includes("ping") ||
      lower.includes("ask") ||
      lower.includes("let me get") ||
      lower.includes("attends") ||
      lower.includes("glad") ||
      lower.includes("worked") ||
      lower.includes("résolu") ||
      lower.includes("resolved") ||
      lower.includes("parfait") ||
      lower.includes("n'hésite pas") ||
      lower.includes("help") ||
      lower.includes("np") ||
      lower.includes("any time");

    if (!hasActionHint) return [];

    const lastMessages = conversationHistory.slice(-4);
    const conversationSnippet = lastMessages
      .map((m) => `[${m.role}]: ${m.content}`)
      .join("\n");

    const prompt = [
      "Analyze the AI's latest response in context. Extract structured actions if any.",
      "Return a JSON array. Only include actions with confidence >= 0.7.",
      "",
      "Action types:",
      '- todo: task to track. Data: { "title": "...", "description": "...", "priority": "low|normal|high|urgent" }',
      '- reminder: time-based alert. Data: { "content": "...", "delayMs": number, "targetSelf": bool }',
      '  Parse relative times: "2h" = 7200000, "demain/tomorrow" = 86400000, "30min" = 1800000, "1h" = 3600000',
      '- escalate: needs human. Data: { "reason": "...", "specialtyNeeded": "developer|designer|manager|support" }',
      '  The reason MUST be professional and neutral. NOT "Model indicated X" but "Client is asking for X which requires manual approval".',
      '- close: ticket/conversation should close. Data: { "reason": "resolved" }',
      "",
      "CONVERSATION:",
      conversationSnippet,
      "",
      "AI RESPONSE:",
      latestAIResponse,
      "",
      'Respond ONLY with a JSON array: [{"type":"...","confidence":0.0-1.0,"data":{...}}]',
      "If no actions detected, respond with: []",
    ].join("\n");

    try {
      const result = await this.ai.generateText(
        "You are an action extractor. Respond only with valid JSON arrays.",
        [{ role: "user", content: prompt }],
        {
          temperature: 0.1,
          maxTokens: 300,
          taskType: "action_detection",
        }
      );

      const jsonMatch = result.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const actions: DetectedAction[] = JSON.parse(jsonMatch[0]);

      // Validate and filter
      return actions
        .filter((a) => {
          if (!a.type || !a.data || typeof a.confidence !== "number") return false;
          if (a.confidence < 0.7) return false;
          if (!["todo", "reminder", "escalate", "assign_role", "close"].includes(a.type)) return false;
          return true;
        })
        .map((a) => ({
          type: a.type,
          confidence: Math.min(1, Math.max(0, a.confidence)),
          data: a.data,
        }));
    } catch (err) {
      logger.warn("ActionParser failed:", err);
      return [];
    }
  }
}
