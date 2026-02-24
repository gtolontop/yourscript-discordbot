import { logger } from "../utils/logger.js";

// ========================
// Types
// ========================

export type TaskType =
  | "classification"
  | "sentiment"
  | "quick_response"
  | "conversation"
  | "complex_analysis"
  | "summary"
  | "embedding"
  | "action_detection"
  | "dm_conversation"
  | "memory_extraction";

export type AlertLevel = "yellow" | "orange" | "red" | "hard_stop";

export interface RequestTrackingData {
  model: string;
  tokensIn: number;
  tokensOut: number;
  cachedTokens: number;
  cost: number;
  latencyMs: number;
  taskType: string;
  ticketId?: string;
  guildId?: string;
}

export interface TicketCostData {
  totalCost: number;
  totalCalls: number;
  modelsUsed: Set<string>;
  startedAt: Date;
}

export interface DaySummary {
  date: string;
  totalSpend: number;
  totalRequests: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCached: number;
  avgCostPerTicket: number;
  byModel: Record<string, { requests: number; cost: number; tokensIn: number; tokensOut: number }>;
  byTaskType: Record<string, { requests: number; cost: number }>;
}

export interface ModelRouterOptions {
  dailyLimitUsd: number;
  onAlert?: (level: AlertLevel, spend: number, limit: number) => void;
  onHardStop?: (spend: number, limit: number) => void;
  onTrack?: (data: RequestTrackingData) => void;
}

// ========================
// Model Pricing (per 1M tokens)
// ========================

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Free OpenRouter Models
  "nousresearch/hermes-3-llama-3.1-405b:free": { input: 0.0, output: 0.0 },
  "meta-llama/llama-3.3-70b-instruct:free": { input: 0.0, output: 0.0 },
  "openai/gpt-oss-120b:free": { input: 0.0, output: 0.0 },
  "qwen/qwen3-next-80b-a3b-instruct:free": { input: 0.0, output: 0.0 },
  "qwen/qwen3-coder:free": { input: 0.0, output: 0.0 },
  "z-ai/glm-4.5-air:free": { input: 0.0, output: 0.0 },
  "arcee-ai/trinity-large-preview:free": { input: 0.0, output: 0.0 },
  "arcee-ai/trinity-mini:free": { input: 0.0, output: 0.0 },

  // Paid OpenRouter Models
  "google/gemini-2.5-flash": { input: 0.075, output: 0.30 },
  "google/gemini-2.5-flash-lite-preview": { input: 0.02, output: 0.08 },
  "google/gemini-2.5-flash-lite": { input: 0.075, output: 0.30 },
  "meta-llama/llama-3.1-8b-instruct": { input: 0.02, output: 0.04 },
  "deepseek/deepseek-v3.2": { input: 0.26, output: 0.38 },
  "x-ai/grok-4.1-fast": { input: 0.20, output: 0.50 },
  "openai/text-embedding-3-small": { input: 0.02, output: 0.00 },
};

const CACHE_DISCOUNT = 0.80; // 80% discount on cached tokens

// ========================
// Model Intelligence Scores (1-10)
// ========================

const MODEL_INTELLIGENCE: Record<string, number> = {
  "nousresearch/hermes-3-llama-3.1-405b:free": 10,
  "deepseek/deepseek-v3.2": 10,
  "x-ai/grok-4.1-fast": 9,
  "openai/gpt-oss-120b:free": 9,
  "qwen/qwen3-next-80b-a3b-instruct:free": 9,
  "meta-llama/llama-3.3-70b-instruct:free": 8,
  "qwen/qwen3-coder:free": 8,
  "google/gemini-2.5-flash": 8,
  "z-ai/glm-4.5-air:free": 7,
  "arcee-ai/trinity-large-preview:free": 7,
  "google/gemini-2.5-flash-lite": 6,
  "google/gemini-2.5-flash-lite-preview": 6,
  "arcee-ai/trinity-mini:free": 5,
  "meta-llama/llama-3.1-8b-instruct": 5,
  "openai/text-embedding-3-small": 5,
};

// ========================
// Task Table (task -> intelligence req)
// ========================

interface TaskConfig {
  requiredIntelligence: number;
  rpm: number;
  rpd: number;
}

const TASK_TABLE: Record<TaskType, TaskConfig> = {
  classification: { requiredIntelligence: 5, rpm: 500, rpd: 50000 },
  sentiment: { requiredIntelligence: 5, rpm: 500, rpd: 50000 },
  quick_response: { requiredIntelligence: 6, rpm: 200, rpd: 10000 },
  action_detection: { requiredIntelligence: 7, rpm: 500, rpd: 50000 },
  summary: { requiredIntelligence: 7, rpm: 500, rpd: 50000 },
  conversation: { requiredIntelligence: 8, rpm: 200, rpd: 10000 },
  dm_conversation: { requiredIntelligence: 8, rpm: 200, rpd: 10000 },
  memory_extraction: { requiredIntelligence: 8, rpm: 500, rpd: 50000 },
  complex_analysis: { requiredIntelligence: 9, rpm: 200, rpd: 10000 },
  embedding: { requiredIntelligence: 0, rpm: 500, rpd: 50000 }, // Managed separately
};

// ========================
// Internal state types
// ========================

interface RateLimitState {
  minuteCount: number;
  minuteReset: number;
  dayCount: number;
  dayReset: number;
}

interface DayState {
  date: string;
  totalSpend: number;
  totalRequests: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCached: number;
  byModel: Record<string, { requests: number; cost: number; tokensIn: number; tokensOut: number }>;
  byTaskType: Record<string, { requests: number; cost: number }>;
  ticketCount: number;
  ticketTotalCost: number;
  alertsSent: Set<AlertLevel>;
}

// ========================
// ModelRouter (unified: routing + budget + rate limiting)
// ========================

export class ModelRouter {
  // Rate limiting
  private rateLimits = new Map<string, RateLimitState>();
  private hardBanned = new Map<string, number>(); // model -> unban timestamp

  // Budget tracking
  private dailyLimitUsd: number;
  private onAlert?: (level: AlertLevel, spend: number, limit: number) => void;
  private onHardStop?: (spend: number, limit: number) => void;
  private onTrack?: (data: RequestTrackingData) => void;
  private currentDay: DayState;
  private ticketCosts = new Map<string, TicketCostData>();
  private history: DaySummary[] = []; // Last 30 days

  constructor(options: ModelRouterOptions) {
    this.dailyLimitUsd = options.dailyLimitUsd;
    this.onAlert = options.onAlert;
    this.onHardStop = options.onHardStop;
    this.onTrack = options.onTrack;
    this.currentDay = this.createDayState();
  }

  // ===== Routing =====

  markRateLimited(model: string, durationSeconds: number = 60): void {
    this.hardBanned.set(model, Date.now() + durationSeconds * 1000);
    logger.warn(`Router: ${model} hard-banned for ${durationSeconds}s`);
  }

  isHardBanned(model: string): boolean {
    const unbanAt = this.hardBanned.get(model);
    if (!unbanAt) return false;
    if (Date.now() >= unbanAt) {
      this.hardBanned.delete(model);
      return false;
    }
    return true;
  }

  getModel(taskType: TaskType): string {
    return this.getWaterfall(taskType)[0] ?? "meta-llama/llama-3.1-8b-instruct:free";
  }

  getWaterfall(taskType: TaskType): string[] {
    if (taskType === "embedding") {
      return ["openai/text-embedding-3-small"];
    }

    const config = TASK_TABLE[taskType];
    if (!config) return ["google/gemini-2.5-flash-lite-preview"];

    const reqInt = config.requiredIntelligence;
    
    // Ordered pool: free models first, then paid fallbacks ordered mostly by cost
    const pool = [
      "nousresearch/hermes-3-llama-3.1-405b:free",
      "openai/gpt-oss-120b:free",
      "qwen/qwen3-next-80b-a3b-instruct:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "qwen/qwen3-coder:free",
      "z-ai/glm-4.5-air:free",
      "arcee-ai/trinity-large-preview:free",
      "arcee-ai/trinity-mini:free",
      "google/gemini-2.5-flash-lite-preview",
      "meta-llama/llama-3.1-8b-instruct",
      "google/gemini-2.5-flash",
      "deepseek/deepseek-v3.2"
    ];

    const eligibleModels = pool.filter(m => (MODEL_INTELLIGENCE[m] || 0) >= reqInt);
    const waterfall: string[] = [];
    
    for (const model of eligibleModels) {
      if (!this.isHardBanned(model)) {
        if (this.isAvailable(model, config.rpm, config.rpd)) {
          waterfall.push(model);
        }
      }
    }

    if (waterfall.length === 0) {
      return [eligibleModels[0] || "google/gemini-2.5-flash-lite-preview"];
    }

    return waterfall;
  }

  getTemperature(taskType: TaskType): number {
    switch (taskType) {
      case "classification":
      case "sentiment":
      case "action_detection":
      case "memory_extraction":
        return 0.1;
      case "quick_response":
        return 0.7;
      case "conversation":
      case "dm_conversation":
        return 0.85;
      case "complex_analysis":
        return 0.4;
      case "summary":
        return 0.3;
      default:
        return 0.7;
    }
  }

  getMaxTokens(taskType: TaskType): number {
    switch (taskType) {
      case "classification":
      case "sentiment":
        return 100;
      case "action_detection":
        return 300;
      case "memory_extraction":
        return 500;
      case "quick_response":
      case "conversation":
      case "dm_conversation":
      case "complex_analysis":
      case "summary":
        return 512;
      default:
        return 512;
    }
  }

  recordUsage(model: string): void {
    const state = this.getState(model);
    state.minuteCount++;
    state.dayCount++;
  }

  getRouterStats(): Record<string, { minuteUsage: number; dayUsage: number }> {
    const stats: Record<string, { minuteUsage: number; dayUsage: number }> = {};
    for (const [model, state] of this.rateLimits) {
      stats[model] = {
        minuteUsage: state.minuteCount,
        dayUsage: state.dayCount,
      };
    }
    return stats;
  }

  // ===== Budget =====

  static calculateCost(model: string, tokensIn: number, tokensOut: number, cachedTokens: number): number {
    const pricing = MODEL_PRICING[model];
    if (!pricing) {
      const fallback = MODEL_PRICING["deepseek/deepseek-v3.2"]!;
      const regularIn = tokensIn - cachedTokens;
      const cachedCost = (cachedTokens / 1_000_000) * fallback.input * (1 - CACHE_DISCOUNT);
      const regularCost = (regularIn / 1_000_000) * fallback.input;
      const outputCost = (tokensOut / 1_000_000) * fallback.output;
      return cachedCost + regularCost + outputCost;
    }

    const regularIn = tokensIn - cachedTokens;
    const cachedCost = (cachedTokens / 1_000_000) * pricing.input * (1 - CACHE_DISCOUNT);
    const regularCost = (regularIn / 1_000_000) * pricing.input;
    const outputCost = (tokensOut / 1_000_000) * pricing.output;
    return cachedCost + regularCost + outputCost;
  }

  isOverBudget(): boolean {
    this.rolloverIfNeeded();
    return this.currentDay.totalSpend >= this.dailyLimitUsd;
  }

  trackRequest(data: Omit<RequestTrackingData, "cost"> & { cost?: number }): RequestTrackingData {
    this.rolloverIfNeeded();

    const cost = data.cost ?? ModelRouter.calculateCost(data.model, data.tokensIn, data.tokensOut, data.cachedTokens);
    const tracked: RequestTrackingData = { ...data, cost };

    // Update day totals
    this.currentDay.totalSpend += cost;
    this.currentDay.totalRequests++;
    this.currentDay.totalTokensIn += data.tokensIn;
    this.currentDay.totalTokensOut += data.tokensOut;
    this.currentDay.totalCached += data.cachedTokens;

    // By model
    if (!this.currentDay.byModel[data.model]) {
      this.currentDay.byModel[data.model] = { requests: 0, cost: 0, tokensIn: 0, tokensOut: 0 };
    }
    const modelStats = this.currentDay.byModel[data.model]!;
    modelStats.requests++;
    modelStats.cost += cost;
    modelStats.tokensIn += data.tokensIn;
    modelStats.tokensOut += data.tokensOut;

    // By task type
    if (!this.currentDay.byTaskType[data.taskType]) {
      this.currentDay.byTaskType[data.taskType] = { requests: 0, cost: 0 };
    }
    const taskStats = this.currentDay.byTaskType[data.taskType]!;
    taskStats.requests++;
    taskStats.cost += cost;

    // Track ticket cost
    if (data.ticketId) {
      if (!this.ticketCosts.has(data.ticketId)) {
        this.ticketCosts.set(data.ticketId, {
          totalCost: 0,
          totalCalls: 0,
          modelsUsed: new Set(),
          startedAt: new Date(),
        });
      }
      const ticket = this.ticketCosts.get(data.ticketId)!;
      ticket.totalCost += cost;
      ticket.totalCalls++;
      ticket.modelsUsed.add(data.model);
    }

    if (this.onTrack) {
      this.onTrack(tracked);
    }

    // Console log
    const cachedStr = data.cachedTokens > 0 ? ` (${data.cachedTokens} cached)` : "";
    const ticketStr = data.ticketId ? ` | ticket:${data.ticketId}` : "";
    logger.cost(
      `${tracked.model} | ${tracked.tokensIn}in/${tracked.tokensOut}out${cachedStr} | $${tracked.cost.toFixed(6)} | ${tracked.latencyMs}ms | ${tracked.taskType}${ticketStr}`
    );

    this.checkAlerts();
    return tracked;
  }

  closeTicket(ticketId: string): TicketCostData | null {
    const data = this.ticketCosts.get(ticketId);
    if (!data) return null;

    this.currentDay.ticketCount++;
    this.currentDay.ticketTotalCost += data.totalCost;

    logger.cost(
      `Ticket ${ticketId} closed | $${data.totalCost.toFixed(6)} total | ${data.totalCalls} calls | models: ${[...data.modelsUsed].join(", ")}`
    );

    this.ticketCosts.delete(ticketId);
    return data;
  }

  getTicketCost(ticketId: string): TicketCostData | null {
    return this.ticketCosts.get(ticketId) ?? null;
  }

  getDaySummary(): DaySummary {
    this.rolloverIfNeeded();
    const avgCost = this.currentDay.ticketCount > 0
      ? this.currentDay.ticketTotalCost / this.currentDay.ticketCount
      : 0;

    return {
      date: this.currentDay.date,
      totalSpend: this.currentDay.totalSpend,
      totalRequests: this.currentDay.totalRequests,
      totalTokensIn: this.currentDay.totalTokensIn,
      totalTokensOut: this.currentDay.totalTokensOut,
      totalCached: this.currentDay.totalCached,
      avgCostPerTicket: avgCost,
      byModel: { ...this.currentDay.byModel },
      byTaskType: { ...this.currentDay.byTaskType },
    };
  }

  getSpendPercentage(): number {
    this.rolloverIfNeeded();
    return (this.currentDay.totalSpend / this.dailyLimitUsd) * 100;
  }

  getHistory(): DaySummary[] {
    return [...this.history];
  }

  // ===== Private: Rate Limiting =====

  private isAvailable(model: string, rpm: number, rpd: number): boolean {
    const state = this.getState(model);
    const now = Date.now();

    if (now > state.minuteReset) {
      state.minuteCount = 0;
      state.minuteReset = now + 60_000;
    }

    if (now > state.dayReset) {
      state.dayCount = 0;
      state.dayReset = now + 86_400_000;
    }

    return state.minuteCount < rpm && state.dayCount < rpd;
  }

  private getState(model: string): RateLimitState {
    if (!this.rateLimits.has(model)) {
      this.rateLimits.set(model, {
        minuteCount: 0,
        minuteReset: Date.now() + 60_000,
        dayCount: 0,
        dayReset: Date.now() + 86_400_000,
      });
    }
    return this.rateLimits.get(model)!;
  }

  // ===== Private: Budget =====

  private createDayState(): DayState {
    return {
      date: this.getTodayString(),
      totalSpend: 0,
      totalRequests: 0,
      totalTokensIn: 0,
      totalTokensOut: 0,
      totalCached: 0,
      byModel: {},
      byTaskType: {},
      ticketCount: 0,
      ticketTotalCost: 0,
      alertsSent: new Set(),
    };
  }

  private rolloverIfNeeded(): void {
    const today = this.getTodayString();
    if (this.currentDay.date !== today) {
      const summary = this.getDaySummaryFromState(this.currentDay);
      this.history.push(summary);

      if (this.history.length > 30) {
        this.history = this.history.slice(-30);
      }

      logger.cost(`Day rollover: ${this.currentDay.date} -> ${today} | Yesterday: $${this.currentDay.totalSpend.toFixed(4)} / ${this.currentDay.totalRequests} requests`);
      this.currentDay = this.createDayState();
    }
  }

  private getDaySummaryFromState(state: DayState): DaySummary {
    const avgCost = state.ticketCount > 0 ? state.ticketTotalCost / state.ticketCount : 0;
    return {
      date: state.date,
      totalSpend: state.totalSpend,
      totalRequests: state.totalRequests,
      totalTokensIn: state.totalTokensIn,
      totalTokensOut: state.totalTokensOut,
      totalCached: state.totalCached,
      avgCostPerTicket: avgCost,
      byModel: { ...state.byModel },
      byTaskType: { ...state.byTaskType },
    };
  }

  private checkAlerts(): void {
    const pct = this.getSpendPercentage();

    if (pct >= 100 && !this.currentDay.alertsSent.has("hard_stop")) {
      this.currentDay.alertsSent.add("hard_stop");
      logger.error(`BUDGET HARD STOP: $${this.currentDay.totalSpend.toFixed(4)} / $${this.dailyLimitUsd} (${pct.toFixed(1)}%)`);
      this.onHardStop?.(this.currentDay.totalSpend, this.dailyLimitUsd);
    } else if (pct >= 90 && !this.currentDay.alertsSent.has("red")) {
      this.currentDay.alertsSent.add("red");
      logger.warn(`BUDGET RED ALERT: $${this.currentDay.totalSpend.toFixed(4)} / $${this.dailyLimitUsd} (${pct.toFixed(1)}%)`);
      this.onAlert?.("red", this.currentDay.totalSpend, this.dailyLimitUsd);
    } else if (pct >= 75 && !this.currentDay.alertsSent.has("orange")) {
      this.currentDay.alertsSent.add("orange");
      logger.warn(`BUDGET ORANGE ALERT: $${this.currentDay.totalSpend.toFixed(4)} / $${this.dailyLimitUsd} (${pct.toFixed(1)}%)`);
      this.onAlert?.("orange", this.currentDay.totalSpend, this.dailyLimitUsd);
    } else if (pct >= 50 && !this.currentDay.alertsSent.has("yellow")) {
      this.currentDay.alertsSent.add("yellow");
      logger.info(`BUDGET YELLOW ALERT: $${this.currentDay.totalSpend.toFixed(4)} / $${this.dailyLimitUsd} (${pct.toFixed(1)}%)`);
      this.onAlert?.("yellow", this.currentDay.totalSpend, this.dailyLimitUsd);
    }
  }

  private getTodayString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }
}
