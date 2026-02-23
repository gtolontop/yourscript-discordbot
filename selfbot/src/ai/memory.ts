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
        .map((m) => `- ${m.content}`);
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
        .map((m) => `- ${m.content}`);
    } catch (err) {
      logger.warn("Failed to embed query for memory retrieval, using fallback");
      return history.memories
        .slice(0, 5)
        .map((m) => `- ${m.content}`);
    }
  }

  async processTicketClose(
    guildId: string,
    userId: string,
    channelId: string,
    messages: Array<{ role: string; content: string }>,
    ticketType?: string
  ): Promise<void> {
    if (messages.length < 2) return;

    try {
      const messagesToKeep = messages.length > 8 ? messages.slice(-8) : messages;
      const conversationText = messagesToKeep
        .map((m) => `${m.role === "model" ? "Staff" : "Client"}: ${m.content}`)
        .join("\n");

      // Si le ticket est très court (ex: 2 messages pour demander un support qui a été auto-résolu) on ne fait ni abstract ni memories, pour gratter $0.0001
      if (messages.length <= 3) {
         logger.ai(`Skipping memory extraction for ${channelId} (ticket too brief)`);
         return;
      }

      const extractionPrompt = [
        "Analysez la conversation.",
        "Retourne UNIQUEMENT en JSON selon le format suivant:",
        "{\"summary\":\"Résumé en 50 mots max\",\"key_points\":[\"point 1\",\"point 2\"],\"memories\":[{\"type\":\"preference|interaction|note|issue\",\"content\":\"Fait notable sur le client (pas le bug, mais le client lui meme)\",\"importance\":1-10}]}",
        "Memories est une liste d'informations importantes à retenir sur l'utilisateur à long terme (ex: est mal poli, préfère parler allemand...)",
        "",
        conversationText,
      ].join("\n");

      const result = await this.ai.generateText(
        "Tu es un extracteur de faits et résumeur. Réponds uniquement en JSON valide.",
        [{ role: "user", content: extractionPrompt }],
        { temperature: 0.2, maxTokens: 800, taskType: "memory_extraction", responseFormat: "json" }
      );

      try {
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);

          const facts = Array.isArray(parsed.memories) ? parsed.memories : [];
          for (const fact of facts.slice(0, 3)) {
            if (!fact.type || !fact.content) continue;
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
              logger.warn(`Failed to save memory: ${fact.content}`);
            }
          }
        }
      } catch {
        logger.warn("Failed to parse close omni JSON result");
      }
    } catch (err) {
      logger.error("Failed to process conversation close:", err);
    }
  }
}
