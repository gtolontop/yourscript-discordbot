import type { AIProvider, AIMessage, AIResponse, EmbeddingResponse } from "./provider.js";
import { ModelRouter, type TaskType } from "./router.js";
import { logger } from "../utils/logger.js";

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
  responseFormat?: "json";
}

export class OpenRouterProvider implements AIProvider {
  private apiKey: string;
  private siteUrl: string;
  private siteName: string;
  private router: ModelRouter;

  constructor(apiKey: string, router: ModelRouter) {
    this.apiKey = apiKey;
    this.router = router;
    this.siteUrl = process.env["OPENROUTER_SITE_URL"] ?? "https://your-script.com";
    this.siteName = process.env["OPENROUTER_SITE_NAME"] ?? "Your Script";
  }

  /**
   * Make a request to OpenRouter chat completions
   */
  private async chatRequest(
    model: string,
    messages: Array<{ role: string; content: string }>,
    options: { temperature?: number; maxTokens?: number; responseFormat?: "json" } = {}
  ): Promise<{ text: string; tokensIn: number; tokensOut: number; cachedTokens: number; model: string }> {
    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: options.temperature ?? 0.8,
      max_tokens: options.maxTokens ?? 1024,
    };

    if (options.responseFormat === "json") {
      body.response_format = { type: "json_object" };
    }

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

      if (response.status === 429 || response.status >= 500) {
        if (attempt < maxRetries && response.status >= 500) {
          const waitMs = 1000 * (attempt + 1);
          await sleep(waitMs);
          continue;
        } else {
          const errorText = await response.text();
          throw new Error(`OpenRouter API error ${response.status}: ${errorText}`);
        }
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
    if (this.router.isOverBudget()) {
      throw new Error("AI budget exceeded - requests blocked");
    }

    const startMs = Date.now();
    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role === "model" ? "assistant" : "user",
        content: m.content,
      })),
    ];

    const taskType = (options.taskType as TaskType) || "conversation";
    let waterfall: string[];
    
    try {
      waterfall = this.router.getWaterfall(taskType);
    } catch {
      waterfall = [options.model ?? "meta-llama/llama-3.1-8b-instruct:free"];
    }

    if (options.model && !waterfall.includes(options.model)) {
      waterfall.unshift(options.model);
    }

    let lastError: Error | null = null;
    let result: any = null;

    for (const model of waterfall) {
      // Don't skip if the specific model was requested dynamically 
      if (this.router.isHardBanned(model) && model !== options.model) continue;

      try {
        this.router.recordUsage(model);
        result = await this.chatRequest(model, chatMessages, {
          temperature: options.temperature ?? this.router.getTemperature(taskType as TaskType),
          maxTokens: options.maxTokens ?? this.router.getMaxTokens(taskType as TaskType),
          responseFormat: options.responseFormat,
        });
        break; // Success
      } catch (err: any) {
        lastError = err;
        logger.warn(`Model ${model} failed for ${taskType}: ${err.message}`);
        
        // Handle rate limiting fast-fail for fallbacks
        if (err.message.includes("429") || err.message.includes("50")) {
          this.router.markRateLimited(model, 60);
        }
      }
    }

    if (!result) {
      throw new Error(`All models failed in waterfall for ${taskType}. Last error: ${lastError?.message}`);
    }

    const latencyMs = Date.now() - startMs;

    this.router.trackRequest({
      model: result.model,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      cachedTokens: result.cachedTokens,
      latencyMs,
      taskType,
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
      model: "openai/text-embedding-3-small",
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
      model: "openai/text-embedding-3-small",
      tokensIn,
      tokensOut: 0,
      cachedTokens: 0,
      latencyMs,
      taskType: "embedding",
    });

    return {
      embedding: data.data[0]?.embedding ?? [],
      model: data.model ?? "openai/text-embedding-3-small",
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
      { temperature: 0.3, maxTokens: 512, taskType: "summary" }
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
        temperature: 0.2, 
        maxTokens: 512, 
        taskType: "summary",
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
   * Get the router (unified routing + budget) instance
   */
  getRouter(): ModelRouter {
    return this.router;
  }
}
