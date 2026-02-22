import type { AIProvider, AIMessage, AIResponse, EmbeddingResponse } from "./provider.js";
import { BudgetMonitor } from "./budget.js";
import { logger } from "../utils/logger.js";

const MODELS = {
  READER: "google/gemini-2.5-flash-8b",
  EXECUTOR: "deepseek/deepseek-chat", // V3 is now chat on openrouter officially
  EMBEDDING: "openai/text-embedding-3-small",
} as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface OpenRouterOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  taskType?: string;
  ticketId?: string;
  guildId?: string;
  role?: "reader" | "executor";
}

export class OpenRouterProvider implements AIProvider {
  private apiKey: string;
  private siteUrl: string;
  private siteName: string;
  private budget: BudgetMonitor;

  constructor(apiKey: string, budget: BudgetMonitor) {
    this.apiKey = apiKey;
    this.budget = budget;
    this.siteUrl = process.env["OPENROUTER_SITE_URL"] ?? "https://discord-bot.local";
    this.siteName = process.env["OPENROUTER_SITE_NAME"] ?? "Discord Bot AI";
  }

  /**
   * Resolve model name: use explicit role, or fall back to the model string from router
   */
  private resolveModel(options: OpenRouterOptions = {}): string {
    if (options.role === "reader") return MODELS.READER;
    if (options.role === "executor") return MODELS.EXECUTOR;
    return options.model ?? MODELS.EXECUTOR;
  }

  /**
   * Make a request to OpenRouter chat completions
   */
  private async chatRequest(
    model: string,
    messages: Array<{ role: string; content: string }>,
    options: { temperature?: number; maxTokens?: number } = {}
  ): Promise<{ text: string; tokensIn: number; tokensOut: number; cachedTokens: number; model: string }> {
    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: options.temperature ?? 0.8,
      max_tokens: options.maxTokens ?? 1024,
    };

    const response = await this.fetchWithRetry("https://openrouter.ai/api/v1/chat/completions", body);

    const data = response as {
      choices: Array<{ message: { content: string | null } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } };
      model?: string;
    };

    const text = data.choices?.[0]?.message?.content ?? "";
    const tokensIn = data.usage?.prompt_tokens ?? 0;
    const tokensOut = data.usage?.completion_tokens ?? 0;
    const cachedTokens = data.usage?.prompt_tokens_details?.cached_tokens ?? 0;
    const usedModel = data.model ?? model;

    return { text, tokensIn, tokensOut, cachedTokens, model: usedModel };
  }

  /**
   * Fetch with retry on 429/5xx
   */
  private async fetchWithRetry(url: string, body: Record<string, unknown>, maxRetries: number = 2): Promise<unknown> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const start = Date.now();
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
          "HTTP-Referer": this.siteUrl,
          "X-Title": this.siteName,
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        return await response.json();
      }

      if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
        const retryAfter = parseInt(response.headers.get("retry-after") ?? "5");
        const waitMs = Math.min(retryAfter * 1000, 30_000) * (attempt + 1);
        logger.warn(`OpenRouter ${response.status} on attempt ${attempt + 1}, retrying in ${waitMs}ms`);
        await sleep(waitMs);
        continue;
      }

      const errorText = await response.text();
      throw new Error(`OpenRouter API error ${response.status}: ${errorText}`);
    }

    throw new Error("OpenRouter: max retries exhausted");
  }

  // ===== AIProvider interface =====

  async generateText(
    systemPrompt: string,
    messages: AIMessage[],
    options: OpenRouterOptions = {}
  ): Promise<AIResponse> {
    if (this.budget.isOverBudget()) {
      throw new Error("AI budget exceeded - requests blocked");
    }

    const model = this.resolveModel(options);
    const startMs = Date.now();

    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role === "model" ? "assistant" : "user",
        content: m.content,
      })),
    ];

    const result = await this.chatRequest(model, chatMessages, {
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    });

    const latencyMs = Date.now() - startMs;

    this.budget.trackRequest({
      model: result.model,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      cachedTokens: result.cachedTokens,
      latencyMs,
      taskType: options.taskType ?? "conversation",
      ticketId: options.ticketId,
      guildId: options.guildId,
    });

    return {
      text: result.text,
      model: result.model,
      tokensUsed: result.tokensIn + result.tokensOut,
    };
  }

  async generateEmbedding(text: string): Promise<EmbeddingResponse> {
    if (this.budget.isOverBudget()) {
      throw new Error("AI budget exceeded - requests blocked");
    }

    const startMs = Date.now();

    const response = await this.fetchWithRetry("https://openrouter.ai/api/v1/embeddings", {
      model: MODELS.EMBEDDING,
      input: text,
    });

    const data = response as {
      data: Array<{ embedding: number[] }>;
      usage?: { prompt_tokens?: number; total_tokens?: number };
      model?: string;
    };

    const latencyMs = Date.now() - startMs;
    const tokensIn = data.usage?.prompt_tokens ?? data.usage?.total_tokens ?? 0;

    this.budget.trackRequest({
      model: MODELS.EMBEDDING,
      tokensIn,
      tokensOut: 0,
      cachedTokens: 0,
      latencyMs,
      taskType: "embedding",
    });

    return {
      embedding: data.data[0]?.embedding ?? [],
      model: data.model ?? MODELS.EMBEDDING,
    };
  }

  async classifyText(
    text: string,
    categories: string[],
    context?: string,
    options: { ticketId?: string; guildId?: string } = {}
  ): Promise<{ category: string; confidence: number }> {
    const prompt = [
      "Classify the following text into one of these categories:",
      categories.map((c) => `- ${c}`).join("\n"),
      "",
      context ? `Context: ${context}` : "",
      "",
      `Text: "${text}"`,
      "",
      'Respond with ONLY a JSON object: {"category": "...", "confidence": 0.0-1.0}',
    ].filter(Boolean).join("\n");

    const result = await this.generateText(
      "You are a text classifier. Respond only with valid JSON.",
      [{ role: "user", content: prompt }],
      { 
        model: MODELS.READER, 
        temperature: 0.1, 
        maxTokens: 100, 
        taskType: "classification",
        ticketId: options.ticketId,
        guildId: options.guildId,
      }
    );

    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          category: parsed.category || categories[0]!,
          confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
        };
      }
    } catch {
      logger.warn("Failed to parse classification response:", result.text);
    }

    return { category: categories[0]!, confidence: 0.5 };
  }

  async analyzeSentiment(
    text: string,
    options: { ticketId?: string; guildId?: string } = {}
  ): Promise<{ sentiment: "positive" | "negative" | "neutral" | "frustrated"; score: number }> {
    const prompt = [
      "Analyze the sentiment of this text from a Discord support ticket.",
      "Categories: positive, negative, neutral, frustrated",
      "",
      `Text: "${text}"`,
      "",
      'Respond with ONLY a JSON object: {"sentiment": "...", "score": 0.0-1.0}',
      "Score: 0 = very negative/frustrated, 0.5 = neutral, 1 = very positive",
    ].join("\n");

    const result = await this.generateText(
      "You are a sentiment analyzer. Respond only with valid JSON.",
      [{ role: "user", content: prompt }],
      { 
        model: MODELS.READER, 
        temperature: 0.1, 
        maxTokens: 100, 
        taskType: "sentiment",
        ticketId: options.ticketId,
        guildId: options.guildId,
      }
    );

    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          sentiment: parsed.sentiment || "neutral",
          score: Math.min(1, Math.max(0, parsed.score || 0.5)),
        };
      }
    } catch {
      logger.warn("Failed to parse sentiment response:", result.text);
    }

    return { sentiment: "neutral", score: 0.5 };
  }

  async summarize(text: string, maxLength: number = 500): Promise<string> {
    const prompt = [
      `Summarize the following text in ${maxLength} characters max. Keep the key points.`,
      "Respond in the same language as the text.",
      "",
      text,
    ].join("\n");

    const result = await this.generateText(
      "You are a summarizer.",
      [{ role: "user", content: prompt }],
      { model: MODELS.READER, temperature: 0.3, maxTokens: 512, taskType: "summary" }
    );

    return result.text;
  }

  /**
   * Generate an incremental ticket summary using the READER model.
   */
  async summarizeTicket(
    previousSummary: string | null,
    newMessages: Array<{ role: string; content: string }>,
    sentimentData?: { overall: string; avgScore: number; trend: string },
    options: { ticketId?: string; guildId?: string } = {}
  ): Promise<{
    summary: string;
    keyPoints: string[];
    suggestions: string[];
    sentiment: string;
  }> {
    const messagesText = newMessages
      .map((m) => `[${m.role}]: ${m.content}`)
      .join("\n");

    const prompt = [
      "You are analyzing a support ticket conversation. Generate a structured summary.",
      "",
      previousSummary ? `PREVIOUS SUMMARY:\n${previousSummary}\n` : "",
      `NEW MESSAGES:\n${messagesText}`,
      "",
      sentimentData ? `SENTIMENT DATA: Overall=${sentimentData.overall}, Score=${sentimentData.avgScore.toFixed(2)}, Trend=${sentimentData.trend}` : "",
      "",
      "Respond with ONLY a JSON object:",
      "{",
      '  "summary": "Updated cumulative summary of the entire ticket (2-4 sentences)",',
      '  "keyPoints": ["key point 1", "key point 2", ...],',
      '  "suggestions": ["what to say or do next based on context", ...],',
      '  "sentiment": "positive|neutral|negative|frustrated"',
      "}",
    ].filter(Boolean).join("\n");

    const result = await this.generateText(
      "You are a ticket summary generator. Respond only with valid JSON.",
      [{ role: "user", content: prompt }],
      { 
        model: MODELS.READER, 
        temperature: 0.2, 
        maxTokens: 512, 
        taskType: "ticket_summary",
        ticketId: options.ticketId,
        guildId: options.guildId,
      }
    );

    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || "No summary available",
          keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
          suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
          sentiment: parsed.sentiment || sentimentData?.overall || "neutral",
        };
      }
    } catch {
      logger.warn("Failed to parse ticket summary response:", result.text);
    }

    return {
      summary: "Failed to generate summary",
      keyPoints: [],
      suggestions: [],
      sentiment: "neutral",
    };
  }

  /**
   * Get the budget monitor instance
   */
  getBudget(): BudgetMonitor {
    return this.budget;
  }
}
