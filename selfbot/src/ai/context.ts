import type { AIMessage } from "./provider.js";

interface ConversationState {
  messages: AIMessage[];
  ticketType: string | null;
  confidence: number;
  exchangeCount: number;
  escalated: boolean;
  systemPrompt: string;
  userId: string;
  guildId: string;
  memories: string[];
}

export class ContextManager {
  private conversations = new Map<string, ConversationState>();
  private maxHistory = 20;

  getOrCreate(channelId: string, userId: string, guildId: string): ConversationState {
    if (!this.conversations.has(channelId)) {
      this.conversations.set(channelId, {
        messages: [],
        ticketType: null,
        confidence: 1.0,
        exchangeCount: 0,
        escalated: false,
        systemPrompt: "",
        userId,
        guildId,
        memories: [],
      });
    }
    return this.conversations.get(channelId)!;
  }

  get(channelId: string): ConversationState | undefined {
    return this.conversations.get(channelId);
  }

  addMessage(channelId: string, role: "user" | "model", content: string): void {
    const state = this.conversations.get(channelId);
    if (!state) return;

    state.messages.push({ role, content });

    // Trim history to prevent context overflow
    if (state.messages.length > this.maxHistory) {
      state.messages = state.messages.slice(-this.maxHistory);
    }

    if (role === "user") {
      state.exchangeCount++;
    }
  }

  setTicketType(channelId: string, type: string, confidence: number): void {
    const state = this.conversations.get(channelId);
    if (!state) return;
    state.ticketType = type;
    state.confidence = confidence;
  }

  setSystemPrompt(channelId: string, prompt: string): void {
    const state = this.conversations.get(channelId);
    if (!state) return;
    state.systemPrompt = prompt;
  }

  setMemories(channelId: string, memories: string[]): void {
    const state = this.conversations.get(channelId);
    if (!state) return;
    state.memories = memories;
  }

  markEscalated(channelId: string): void {
    const state = this.conversations.get(channelId);
    if (!state) return;
    state.escalated = true;
  }

  unmarkEscalated(channelId: string): void {
    const state = this.conversations.get(channelId);
    if (!state) return;
    state.escalated = false;
  }

  isEscalated(channelId: string): boolean {
    return this.conversations.get(channelId)?.escalated ?? false;
  }

  reduceConfidence(channelId: string, amount: number): void {
    const state = this.conversations.get(channelId);
    if (!state) return;
    state.confidence = Math.max(0, state.confidence - amount);
  }

  getMessages(channelId: string): AIMessage[] {
    return this.conversations.get(channelId)?.messages ?? [];
  }

  getFullSystemPrompt(channelId: string): string {
    const state = this.conversations.get(channelId);
    if (!state) return "";

    let prompt = state.systemPrompt;
    if (state.memories.length > 0) {
      prompt += "\n\nMÉMOIRES DU CLIENT (interactions passées):\n";
      prompt += state.memories.map((m) => `- ${m}`).join("\n");
    }
    return prompt;
  }

  remove(channelId: string): void {
    this.conversations.delete(channelId);
  }

  getActiveCount(): number {
    return this.conversations.size;
  }
}
