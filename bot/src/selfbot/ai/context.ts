import type { ChatMessage } from "./provider.js";

interface ChannelContext {
  messages: ChatMessage[];
  lastActivity: number;
}

export class ContextManager {
  private contexts: Map<string, ChannelContext> = new Map();
  private maxMessages: number;
  private ttlMs: number;

  constructor(maxMessages = 50, ttlMinutes = 30) {
    this.maxMessages = maxMessages;
    this.ttlMs = ttlMinutes * 60 * 1000;

    // Cleanup old contexts every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  getMessages(channelId: string): ChatMessage[] {
    const ctx = this.contexts.get(channelId);
    if (!ctx) return [];
    return [...ctx.messages];
  }

  addMessage(channelId: string, message: ChatMessage): void {
    let ctx = this.contexts.get(channelId);
    if (!ctx) {
      ctx = { messages: [], lastActivity: Date.now() };
      this.contexts.set(channelId, ctx);
    }

    ctx.messages.push(message);
    ctx.lastActivity = Date.now();

    // Trim to max messages (keep system message if present)
    if (ctx.messages.length > this.maxMessages) {
      const systemMsg = ctx.messages.find((m) => m.role === "system");
      ctx.messages = ctx.messages.slice(-this.maxMessages);
      if (systemMsg && ctx.messages[0]?.role !== "system") {
        ctx.messages.unshift(systemMsg);
      }
    }
  }

  clearChannel(channelId: string): void {
    this.contexts.delete(channelId);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [channelId, ctx] of this.contexts) {
      if (now - ctx.lastActivity > this.ttlMs) {
        this.contexts.delete(channelId);
      }
    }
  }
}
