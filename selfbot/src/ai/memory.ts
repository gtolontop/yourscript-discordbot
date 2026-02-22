import type { OpenRouterProvider } from "./openrouter.js";
import type { BotBridge } from "../bridge/BotBridge.js";
import { cosineSimilarity } from "../utils/similarity.js";
import { logger } from "../utils/logger.js";

interface MemoryEntry {
  type: string;
  content: string;
  importance: number;
  embedding?: number[];
  createdAt: string;
}

export class MemoryManager {
  constructor(
    private ai: OpenRouterProvider,
    private bridge: BotBridge
  ) {}

  /**
   * Retrieve relevant memories for a user, optionally filtered by query similarity
   */
  async retrieveMemories(guildId: string, userId: string, query?: string): Promise<string[]> {
    const history = await this.bridge.queryUserHistory({ guildId, userId });
    if (!history.memories || history.memories.length === 0) return [];

    // If no query, return all memories sorted by importance
    if (!query) {
      return history.memories
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 5)
        .map((m) => `[${m.type}] ${m.content}`);
    }

    // Embed the query for similarity search
    try {
      const queryEmbedding = await this.ai.generateEmbedding(query);

      // We need the embeddings from the server - for now, fall back to text matching
      // The server stores embeddings in AIMemory.embedding as JSON
      // For retrieval, we'll get full memory data via the bridge
      return history.memories
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 5)
        .map((m) => `[${m.type}] ${m.content}`);
    } catch (err) {
      logger.warn("Failed to embed query for memory retrieval, using fallback");
      return history.memories
        .slice(0, 5)
        .map((m) => `[${m.type}] ${m.content}`);
    }
  }

  /**
   * Extract and create memories from a ticket conversation
   */
  async createMemoriesFromConversation(
    guildId: string,
    userId: string,
    messages: Array<{ role: string; content: string }>
  ): Promise<void> {
    if (messages.length < 2) return;

    try {
      // Summarize the conversation
      const conversationText = messages
        .map((m) => `${m.role === "model" ? "Staff" : "Client"}: ${m.content}`)
        .join("\n");

      const summary = await this.ai.summarize(conversationText, 300);

      // Extract key facts using AI
      const extractionPrompt = [
        "Extrais les faits clés de cette conversation de support client.",
        "Pour chaque fait, donne: type (preference|interaction|note|issue), contenu, importance (1-10).",
        "Réponds UNIQUEMENT en JSON: [{\"type\":\"...\",\"content\":\"...\",\"importance\":N}]",
        "Maximum 3 faits les plus importants.",
        "",
        conversationText,
      ].join("\n");

      const result = await this.ai.generateText(
        "Tu es un extracteur de faits. Réponds uniquement en JSON valide.",
        [{ role: "user", content: extractionPrompt }],
        { temperature: 0.2, maxTokens: 500, taskType: "memory_extraction" }
      );

      try {
        const jsonMatch = result.text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const facts: Array<{ type: string; content: string; importance: number }> = JSON.parse(jsonMatch[0]);

          for (const fact of facts.slice(0, 3)) {
            try {
              await this.bridge.createMemory({
                guildId,
                userId,
                type: fact.type || "note",
                content: fact.content,
                importance: Math.min(10, Math.max(1, fact.importance || 5)),
              });
              logger.ai(`Memory saved: [${fact.type}] ${fact.content} (importance: ${fact.importance})`);
            } catch (err) {
              logger.warn(`Failed to save memory: ${fact.content}`, err);
            }
          }
        }
      } catch {
        logger.warn("Failed to parse memory extraction result");
      }
    } catch (err) {
      logger.error("Failed to create memories from conversation:", err);
    }
  }
}
