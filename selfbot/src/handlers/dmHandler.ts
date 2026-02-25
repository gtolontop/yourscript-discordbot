import type { Client as SelfbotClient } from "discord.js-selfbot-v13";
import type { BotBridge } from "../bridge/BotBridge.js";
import type { OpenRouterProvider } from "../ai/openrouter.js";
import type { ModelRouter } from "../ai/router.js";
import type { ActionParser } from "../ai/actionParser.js";
import { ContextManager } from "../ai/context.js";
import { MemoryManager } from "../ai/memory.js";
import {
  getDMSystemPrompt,
  detectLanguage,
  type SupportedLanguage,
  type KnowledgeItem,
} from "../ai/personality.js";
import { simulateTyping } from "../utils/delay.js";
import { logger } from "../utils/logger.js";
import type { DMThreadReplyEvent } from "../bridge/types.js";

interface DMConversation {
  threadId: string;
  username: string;
  lastActivity: number;
  staffActive: boolean;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const DM_RATE_LIMIT = 20; // max messages per hour per user
const DM_RATE_WINDOW = 60 * 60 * 1000; // 1 hour

export class DMHandler {
  private conversations = new Map<string, DMConversation>();
  private threadToUser = new Map<string, string>(); // threadId → userId
  private rateLimits = new Map<string, RateLimitEntry>();
  private context: ContextManager;
  private memory: MemoryManager;
  private dmLogChannelId: string;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  // Knowledge cache (shared pattern with ticketHandler)
  private knowledgeCache = new Map<string, { entries: KnowledgeItem[]; fetchedAt: number }>();

  constructor(
    private selfbot: SelfbotClient,
    private bridge: BotBridge,
    private ai: OpenRouterProvider,
    private router: ModelRouter,
    private actionParser?: ActionParser
  ) {
    this.context = new ContextManager();
    this.memory = new MemoryManager(ai, bridge);
    this.dmLogChannelId = process.env["AI_DM_LOG_CHANNEL"] ?? "";

    // Cleanup inactive conversations every 30 min
    this.cleanupInterval = setInterval(() => this.cleanup(), 30 * 60 * 1000);
  }

  async handleDM(message: any): Promise<void> {
    const userId = message.author.id;
    const username = message.author.username;
    const content = message.content;

    if (!content || !this.dmLogChannelId) return;

    // Rate limit check
    if (this.isRateLimited(userId)) {
      logger.dm(`Rate limited DM from ${username} (${userId})`);
      return;
    }

    // Budget check
    if (this.ai.getRouter().isOverBudget()) {
      logger.dm(`Budget exceeded, ignoring DM from ${username}`);
      return;
    }

    logger.dm(`DM from ${username}: ${content.substring(0, 80)}...`);

    // Find or create thread
    const threadId = await this.ensureThread(userId, username);
    if (!threadId) {
      logger.error(`Failed to create DM log thread for ${username}`);
      return;
    }

    // Log user message in thread (blue embed)
    await this.bridge.sendToThread({
      threadId,
      embed: {
        description: content,
        color: 0x3498db, // blue
        author: `${username} (DM)`,
        footer: `User ID: ${userId}`,
      },
    });

    // If staff is active in this conversation, don't respond with AI
    const conv = this.conversations.get(userId);
    if (conv?.staffActive) {
      logger.dm(`Staff active for ${username}, AI staying quiet`);
      return;
    }

    // Detect language
    const lang = detectLanguage(content);

    // Init or get context
    const contextKey = `dm_${userId}`;
    this.context.getOrCreate(contextKey, userId, "dm");

    // Load memories
    // We need a guildId for memory retrieval - use first guild the bot shares with the user
    const sharedGuild = this.selfbot.guilds.cache.find((g: any) =>
      g.members.cache.has(userId)
    );
    const guildId = sharedGuild?.id ?? "global";

    let memories: string[] = [];
    try {
      memories = await this.memory.retrieveMemories(guildId, userId, content);
      if (memories.length > 0) {
        this.context.setMemories(contextKey, memories);
      }
    } catch {}

    // Get knowledge base
    let knowledge: KnowledgeItem[] = [];
    if (guildId !== "global") {
      knowledge = await this.getKnowledge(guildId);
    }

    // Build system prompt
    const memoryContext = memories.length > 0 ? `You know this about the user:\n${memories.join("\n")}` : undefined;
    const systemPrompt = getDMSystemPrompt(lang, memoryContext, knowledge);
    this.context.setSystemPrompt(contextKey, systemPrompt);

    // Add user message
    this.context.addMessage(contextKey, "user", content);

    // Generate AI response
    try {
      const taskType = "dm_conversation" as any;
      const model = this.router.getModel(taskType);

      const response = await this.ai.generateText(
        this.context.getFullSystemPrompt(contextKey),
        this.context.getMessages(contextKey),
        {
          model,
          temperature: this.router.getTemperature(taskType),
          maxTokens: this.router.getMaxTokens(taskType),
          taskType: "dm_conversation",
          ticketId: `dm_${userId}`,
          guildId,
        }
      );

      this.context.addMessage(contextKey, "model", response.text);

      // Simulate typing and send DM
      const baseDelay = parseInt(process.env["AI_RESPONSE_DELAY"] ?? "3");
      await simulateTyping(message.channel, response.text.length, baseDelay);
      await message.channel.send(response.text);

      // Log AI response in thread (green embed)
      await this.bridge.sendToThread({
        threadId,
        embed: {
          description: response.text,
          color: 0x2ecc71, // green
          author: process.env["AI_PERSONA_NAME"] ?? "Lucas",
          footer: "AI Response",
        },
      });

      // Detect actions
      if (this.actionParser) {
        try {
          const actions = await this.actionParser.detectActions(
            this.context.getMessages(contextKey),
            response.text,
            { channelId: contextKey, guildId, userId }
          );

          for (const action of actions) {
            if (action.confidence < 0.7) continue;
            switch (action.type) {
              case "todo": {
                const todoData = action.data as { title: string; description?: string; priority?: string };
                await this.bridge.addTodo({
                  guildId,
                  title: todoData.title,
                  description: todoData.description,
                  priority: (todoData.priority as any) ?? "normal",
                });
                break;
              }
              case "reminder": {
                const reminderData = action.data as { content: string; delayMs: number };
                await this.bridge.createReminder({
                  guildId,
                  userId,
                  content: reminderData.content,
                  triggerAt: new Date(Date.now() + reminderData.delayMs).toISOString(),
                  sourceType: "dm",
                  sourceId: `dm_${userId}`,
                });
                break;
              }
            }
          }
        } catch (err) {
          logger.error("Failed to detect actions in DM:", err);
        }
      }

      logger.dm(`Responded to ${username} in DM`);
    } catch (err) {
      logger.error("Failed to respond to DM:", err);
    }

    // Update rate limit
    this.trackRateLimit(userId);
  }

  async handleStaffThreadReply(data: DMThreadReplyEvent): Promise<void> {
    const userId = this.threadToUser.get(data.threadId);
    if (!userId) {
      logger.dm(`Unknown thread ${data.threadId} for staff reply`);
      return;
    }

    // Send DM to user via selfbot
    try {
      const user = await this.selfbot.users.fetch(userId);
      const dmChannel = await user.createDM();
      await dmChannel.send(data.content);

      logger.dm(`Staff ${data.username} replied to ${userId} via thread`);
    } catch (err) {
      logger.error(`Failed to relay staff reply to ${userId}:`, err);
    }

    // Log in thread (orange embed)
    await this.bridge.sendToThread({
      threadId: data.threadId,
      embed: {
        description: data.content,
        color: 0xe67e22, // orange
        author: `${data.username} (Staff)`,
        footer: `Staff ID: ${data.userId}`,
      },
    });

    // Mark conversation as staff active
    const conv = this.conversations.get(userId);
    if (conv) {
      conv.staffActive = true;
    }
  }

  handleThreadMessage(message: any): void {
    // Only handle threads in the DM log channel
    if (!this.dmLogChannelId) return;
    if (message.channel.parentId !== this.dmLogChannelId) return;

    // Ignore bot and selfbot messages
    if (message.author.bot) return;
    if (message.author.id === this.selfbot.user?.id) return;

    const threadId = message.channel.id;
    const userId = this.threadToUser.get(threadId);
    if (!userId) return;

    // This is a staff reply in a DM log thread
    this.handleStaffThreadReply({
      threadId,
      content: message.content,
      userId: message.author.id,
      username: message.author.username,
    });
  }

  getActiveDMCount(): number {
    return this.conversations.size;
  }

  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // ===== Private =====

  private async ensureThread(userId: string, username: string): Promise<string | null> {
    const existing = this.conversations.get(userId);
    if (existing) {
      existing.lastActivity = Date.now();
      return existing.threadId;
    }

    // Create thread via bridge
    const today = new Date().toISOString().split("T")[0];
    try {
      const result = await this.bridge.createDMThread({
        channelId: this.dmLogChannelId,
        userId,
        username,
        threadName: `${username} - ${today}`,
      });

      if (result.success && result.threadId) {
        this.conversations.set(userId, {
          threadId: result.threadId,
          username,
          lastActivity: Date.now(),
          staffActive: false,
        });
        this.threadToUser.set(result.threadId, userId);
        logger.dm(`Created DM log thread for ${username}: ${result.threadId}`);
        return result.threadId;
      }

      logger.error(`Failed to create DM thread: ${result.error}`);
      return null;
    } catch (err) {
      logger.error("Bridge error creating DM thread:", err);
      return null;
    }
  }

  private isRateLimited(userId: string): boolean {
    const entry = this.rateLimits.get(userId);
    if (!entry) return false;

    if (Date.now() > entry.resetAt) {
      this.rateLimits.delete(userId);
      return false;
    }

    return entry.count >= DM_RATE_LIMIT;
  }

  private trackRateLimit(userId: string): void {
    const entry = this.rateLimits.get(userId);
    if (!entry || Date.now() > entry.resetAt) {
      this.rateLimits.set(userId, {
        count: 1,
        resetAt: Date.now() + DM_RATE_WINDOW,
      });
    } else {
      entry.count++;
    }
  }

  private async getKnowledge(guildId: string): Promise<KnowledgeItem[]> {
    const cached = this.knowledgeCache.get(guildId);
    if (cached && Date.now() - cached.fetchedAt < 5 * 60 * 1000) {
      return cached.entries;
    }

    try {
      const entries = await this.bridge.queryKnowledge({ guildId });
      this.knowledgeCache.set(guildId, { entries, fetchedAt: Date.now() });
      return entries;
    } catch {
      return cached?.entries ?? [];
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    for (const [userId, conv] of this.conversations) {
      if (now - conv.lastActivity > oneHour) {
        this.context.remove(`dm_${userId}`);
        this.threadToUser.delete(conv.threadId);
        this.conversations.delete(userId);
        logger.dm(`Cleaned up inactive DM conversation with ${conv.username}`);
      }
    }
  }
}
