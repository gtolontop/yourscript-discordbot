import { logger } from "../utils/logger.js";

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

interface ModelConfig {
  model: string;
  rpm: number;
  rpd: number;
  fallback?: string;
}

const MODEL_TABLE: Record<TaskType, ModelConfig> = {
  classification: {
    model: "google/gemini-2.5-flash-lite",
    fallback: "google/gemini-2.5-flash",
    rpm: 500,
    rpd: 50000,
  },
  sentiment: {
    model: "google/gemini-2.5-flash-lite",
    fallback: "google/gemini-2.5-flash",
    rpm: 500,
    rpd: 50000,
  },
  quick_response: {
    model: "google/gemini-2.5-flash-lite",
    fallback: "google/gemini-2.5-flash",
    rpm: 200,
    rpd: 10000,
  },
  conversation: {
    model: "google/gemini-2.5-flash-lite",
    fallback: "google/gemini-2.5-flash",
    rpm: 200,
    rpd: 10000,
  },
  complex_analysis: {
    model: "google/gemini-2.5-flash-lite",
    fallback: "google/gemini-2.5-flash",
    rpm: 200,
    rpd: 10000,
  },
  summary: {
    model: "google/gemini-2.5-flash-lite",
    fallback: "google/gemini-2.5-flash",
    rpm: 500,
    rpd: 50000,
  },
  embedding: {
    model: "openai/text-embedding-3-small",
    rpm: 500,
    rpd: 50000,
  },
  action_detection: {
    model: "google/gemini-2.5-flash-lite",
    fallback: "google/gemini-2.5-flash",
    rpm: 500,
    rpd: 50000,
  },
  dm_conversation: {
    model: "google/gemini-2.5-flash-lite",
    fallback: "google/gemini-2.5-flash",
    rpm: 200,
    rpd: 10000,
  },
  memory_extraction: {
    model: "google/gemini-2.5-flash-lite",
    fallback: "google/gemini-2.5-flash",
    rpm: 500,
    rpd: 50000,
  },
};

interface RateLimitState {
  minuteCount: number;
  minuteReset: number;
  dayCount: number;
  dayReset: number;
}

export class ModelRouter {
  private rateLimits = new Map<string, RateLimitState>();
  // Models that returned a real 429 from API
  private hardBanned = new Map<string, number>(); // model -> unban timestamp

  /**
   * Mark a model as hard-banned (got a real 429 from Google)
   */
  markRateLimited(model: string, durationSeconds: number = 60): void {
    this.hardBanned.set(model, Date.now() + durationSeconds * 1000);
    logger.warn(`Router: ${model} hard-banned for ${durationSeconds}s`);
  }

  private isHardBanned(model: string): boolean {
    const unbanAt = this.hardBanned.get(model);
    if (!unbanAt) return false;
    if (Date.now() >= unbanAt) {
      this.hardBanned.delete(model);
      return false;
    }
    return true;
  }

  getModel(taskType: TaskType): string {
    const config = MODEL_TABLE[taskType];
    if (!config) return "google/gemini-2.5-flash-lite-preview";

    // Check if primary model is available (not hard-banned and within soft limits)
    if (!this.isHardBanned(config.model) && this.isAvailable(config.model, config.rpm, config.rpd)) {
      this.recordUsage(config.model);
      return config.model;
    }

    // Generic fallback: Use defined fallback or grok
    const fallback = config.fallback || "deepseek/deepseek-v3.2";

    if (!this.isHardBanned(fallback)) {
      logger.ai(`Rate limited on ${config.model}, falling back to ${fallback}`);
      this.recordUsage(fallback);
      return fallback;
    }

    // Last resort: return primary anyway, OpenRouter will manage
    logger.warn(`All models rate limited for ${taskType}, using ${config.model} anyway`);
    return config.model;
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
        return 512;
      case "conversation":
      case "dm_conversation":
        return 512;
      case "complex_analysis":
        return 512;
      case "summary":
        return 512;
      default:
        return 512;
    }
  }

  getStats(): Record<string, { minuteUsage: number; dayUsage: number }> {
    const stats: Record<string, { minuteUsage: number; dayUsage: number }> = {};
    for (const [model, state] of this.rateLimits) {
      stats[model] = {
        minuteUsage: state.minuteCount,
        dayUsage: state.dayCount,
      };
    }
    return stats;
  }

  private isAvailable(model: string, rpm: number, rpd: number): boolean {
    const state = this.getState(model);
    const now = Date.now();

    // Reset minute counter if needed
    if (now > state.minuteReset) {
      state.minuteCount = 0;
      state.minuteReset = now + 60_000;
    }

    // Reset day counter if needed
    if (now > state.dayReset) {
      state.dayCount = 0;
      state.dayReset = now + 86_400_000;
    }

    return state.minuteCount < rpm && state.dayCount < rpd;
  }

  private recordUsage(model: string): void {
    const state = this.getState(model);
    state.minuteCount++;
    state.dayCount++;
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

  private findModelConfig(modelName: string): ModelConfig | null {
    for (const config of Object.values(MODEL_TABLE)) {
      if (config.model === modelName) return config;
    }
    return null;
  }
}
