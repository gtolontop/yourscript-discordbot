import { logger } from "../utils/logger.js";

// Price per 1M tokens (USD)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Free OpenRouter Models
  "meta-llama/llama-3.1-8b-instruct:free": { input: 0.0, output: 0.0 },
  "meta-llama/llama-3.3-70b-instruct:free": { input: 0.0, output: 0.0 },
  "openai/gpt-oss-120b:free": { input: 0.0, output: 0.0 },
  "qwen/qwen-2.5-72b-instruct:free": { input: 0.0, output: 0.0 },
  "z-ai/glm-4.5-air:free": { input: 0.0, output: 0.0 },
  "arcee-ai/trinity-large-preview:free": { input: 0.0, output: 0.0 },

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

export interface BudgetMonitorOptions {
  dailyLimitUsd: number;
  onAlert?: (level: AlertLevel, spend: number, limit: number) => void;
  onHardStop?: (spend: number, limit: number) => void;
  onTrack?: (data: RequestTrackingData) => void;
}

export class BudgetMonitor {
  private dailyLimitUsd: number;
  private onAlert?: (level: AlertLevel, spend: number, limit: number) => void;
  private onHardStop?: (spend: number, limit: number) => void;
  private onTrack?: (data: RequestTrackingData) => void;

  private currentDay: DayState;
  private ticketCosts = new Map<string, TicketCostData>();
  private history: DaySummary[] = []; // Last 30 days

  constructor(options: BudgetMonitorOptions) {
    this.dailyLimitUsd = options.dailyLimitUsd;
    this.onAlert = options.onAlert;
    this.onHardStop = options.onHardStop;
    this.onTrack = options.onTrack;
    this.currentDay = this.createDayState();
  }

  /**
   * Calculate cost for a request based on model pricing
   */
  static calculateCost(model: string, tokensIn: number, tokensOut: number, cachedTokens: number): number {
    const pricing = MODEL_PRICING[model];
    if (!pricing) {
      // Fallback: use deepseek pricing for unknown models
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

  /**
   * Check if we're over budget (hard stop)
   */
  isOverBudget(): boolean {
    this.rolloverIfNeeded();
    return this.currentDay.totalSpend >= this.dailyLimitUsd;
  }

  /**
   * Track a completed request
   */
  trackRequest(data: Omit<RequestTrackingData, "cost"> & { cost?: number }): RequestTrackingData {
    this.rolloverIfNeeded();

    const cost = data.cost ?? BudgetMonitor.calculateCost(data.model, data.tokensIn, data.tokensOut, data.cachedTokens);

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

    // Check alert thresholds
    this.checkAlerts();

    return tracked;
  }

  /**
   * Close a ticket and return its cost data
   */
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

  /**
   * Get ticket cost data (without closing)
   */
  getTicketCost(ticketId: string): TicketCostData | null {
    return this.ticketCosts.get(ticketId) ?? null;
  }

  /**
   * Get current day summary
   */
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

  /**
   * Get spend percentage (0-100+)
   */
  getSpendPercentage(): number {
    this.rolloverIfNeeded();
    return (this.currentDay.totalSpend / this.dailyLimitUsd) * 100;
  }

  /**
   * Get history of past days
   */
  getHistory(): DaySummary[] {
    return [...this.history];
  }

  // ===== Private =====

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
      // Save current day to history
      const summary = this.getDaySummaryFromState(this.currentDay);
      this.history.push(summary);

      // Keep only last 30 days
      if (this.history.length > 30) {
        this.history = this.history.slice(-30);
      }

      logger.cost(`Day rollover: ${this.currentDay.date} -> ${today} | Yesterday: $${this.currentDay.totalSpend.toFixed(4)} / ${this.currentDay.totalRequests} requests`);

      // Reset
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
