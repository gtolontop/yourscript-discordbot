import type { Client as SelfbotClient } from "discord.js-selfbot-v13";
import type { BotBridge } from "../bridge/BotBridge.js";
import type { OpenRouterProvider } from "../ai/openrouter.js";
import type { ModelRouter } from "../ai/router.js";
import type { ActionParser } from "../ai/actionParser.js";
import { ContextManager } from "../ai/context.js";
import { MemoryManager } from "../ai/memory.js";
import {
  getTicketSystemPrompt,
  detectLanguage,
  getEscalateMessage,
  type SupportedLanguage,
  type KnowledgeItem,
} from "../ai/personality.js";
import { simulateTyping } from "../utils/delay.js";
import { logger } from "../utils/logger.js";
import type {
  TicketNewEvent,
  TicketMessageEvent,
  TicketCloseEvent,
} from "../bridge/types.js";

// Only escalate when user explicitly asks for human/manager or money-related issues
const ESCALATION_KEYWORDS = [
  // EN - explicit human request
  "real person", "talk to a human", "speak to someone", "manager", "supervisor",
  // EN - money
  "refund", "money back", "chargeback",
  // FR - explicit human request
  "parler à un humain", "vrai personne", "responsable", "un humain",
  // FR - money
  "remboursement", "rembourser", "remboursez",
  // ES
  "persona real", "hablar con alguien", "gerente", "reembolso",
];

const CLOSE_KEYWORDS = [
  // EN
  "bye", "goodbye", "thanks that's all", "that's it", "all good", "resolved", "fixed", "problem solved",
  "you can close", "close the ticket", "no more questions", "all set", "that was it",
  // FR
  "au revoir", "aurevoir", "merci c'est tout", "c'est bon", "c'est réglé", "c'est résolu",
  "tu peux fermer", "fermer le ticket", "plus de questions", "c'est tout", "merci bcp",
  "merci beaucoup", "c'est parfait", "nickel", "impec", "rien d'autre",
  // ES
  "adiós", "adios", "gracias eso es todo", "resuelto", "cerrar el ticket",
];

const MAX_EXCHANGES_BEFORE_ESCALATION = 12;
const MIN_CONFIDENCE_THRESHOLD = 0.45;

// Channels where AI is waiting for user's first message
const waitingForUser = new Set<string>();

// Track staff-backed-off channels with the staff userId and timestamp
const staffBackedOff = new Map<string, { staffId: string; lastStaffMsg: number; lastUserMsg: number }>();

// Track the last time a user pinged staff in a channel to prevent spam (Smart Ping Management)
const lastStaffPings = new Map<string, number>();

export class TicketHandler {
  private context: ContextManager;
  private memory: MemoryManager;
  private actionParser?: ActionParser;
  private ticketLanguages = new Map<string, SupportedLanguage>();
  // Track sentiment per ticket for summary temperature
  private ticketSentiments = new Map<string, Array<{ sentiment: string; score: number; timestamp: number }>>();
  // Knowledge base cache per guild (refreshed every 5 min)
  private knowledgeCache = new Map<string, { entries: KnowledgeItem[]; fetchedAt: number }>();

  constructor(
    private selfbot: SelfbotClient,
    private bridge: BotBridge,
    private ai: OpenRouterProvider,
    private router: ModelRouter,
    actionParser?: ActionParser
  ) {
    this.context = new ContextManager();
    this.memory = new MemoryManager(ai, bridge);
    this.actionParser = actionParser;
  }

  /**
   * New ticket created
   */
  async handleNewTicket(data: TicketNewEvent): Promise<void> {
    logger.ai(`New ticket #${data.number} in ${data.channelId}`);

    const channel = await this.selfbot.channels.fetch(data.channelId).catch(() => null);
    if (!channel || !channel.isText()) return;

    // Init context
    this.context.getOrCreate(data.channelId, data.userId, data.guildId);

    // If no subject: wait for user to say something first
    if (!data.subject) {
      waitingForUser.add(data.channelId);
      logger.ai(`No subject on ticket #${data.number}, waiting for user to speak`);
      return;
    }

    // Has a subject: detect lang, classify, respond
    const lang = detectLanguage(data.subject);
    this.ticketLanguages.set(data.channelId, lang);

    await this.setupAndRespond(data.channelId, data, lang, `${data.subject}`);
  }

  /**
   * Message in a ticket channel
   */
  async handleTicketMessage(data: TicketMessageEvent): Promise<void> {
    if (data.isBot) return;
    if (data.userId === this.selfbot.user?.id) return;

    const channelId = data.channelId;

    // If staff is talking, AI backs off but tracks it
    if (data.isStaff) {
      if (!this.context.isEscalated(channelId)) {
        this.context.markEscalated(channelId);
        logger.ai(`Staff responded in ${channelId}, AI backing off`);
      }
      // Track the staff member for potential re-engagement
      staffBackedOff.set(channelId, {
        staffId: data.userId,
        lastStaffMsg: Date.now(),
        lastUserMsg: staffBackedOff.get(channelId)?.lastUserMsg ?? 0,
      });
      return;
    }

    // If escalated (staff took over), check if we should re-engage or remind staff
    if (this.context.isEscalated(channelId)) {
      const backoff = staffBackedOff.get(channelId);
      if (backoff) {
        backoff.lastUserMsg = Date.now();
        const timeSinceStaff = Date.now() - backoff.lastStaffMsg;

        // If staff hasn't responded in 15+ minutes and user just sent a message
        if (timeSinceStaff > 15 * 60 * 1000) {
          // Try to determine if AI can handle this confidently
          const canResume = await this.canAIResume(data.content, channelId);

          if (canResume) {
            // AI is very confident it can help - resume the conversation
            logger.ai(`AI resuming conversation in ${channelId} (staff inactive 15min+)`);
            this.context.unmarkEscalated(channelId);
            staffBackedOff.delete(channelId);
            // Fall through to normal handling below
          } else {
            // Not confident enough - just ping the staff member as a natural reminder
            const channel = await this.selfbot.channels.fetch(channelId).catch(() => null);
            if (channel?.isText()) {
              const lang = this.ticketLanguages.get(channelId) ?? "en";
              const reminders: Record<string, string> = {
                en: `hey <@${backoff.staffId}> just a heads up, they sent another message ^`,
                fr: `hey <@${backoff.staffId}> petit rappel, il a renvoyé un message ^`,
                es: `hey <@${backoff.staffId}> aviso, mandó otro mensaje ^`,
                de: `hey <@${backoff.staffId}> kurze info, hat nochmal geschrieben ^`,
                pt: `hey <@${backoff.staffId}> aviso, mandou outra mensagem ^`,
              };
              await (channel as any).send(reminders[lang] ?? reminders.en);
              // Update the timestamp so we don't spam
              backoff.lastStaffMsg = Date.now();
            }
            return;
          }
        } else {
          return; // Staff is still active, stay quiet
        }
      } else {
        return;
      }
    }

    // Smart Ping Management: Avoid repeated @Staff or role pings
    const pingRegex = /<@&\d+>|@everyone|@here/i;
    if (pingRegex.test(data.content)) {
      const now = Date.now();
      const lastPing = lastStaffPings.get(channelId) || 0;
      // 1 hour cooldown for pings
      if (now - lastPing < 60 * 60 * 1000) {
        logger.ai(`Preventing frequent staff ping in ${channelId}`);
        const channel = await this.selfbot.channels.fetch(channelId).catch(() => null);
        if (channel?.isText()) {
           const lang = this.ticketLanguages.get(channelId) ?? "en";
           const warnings: Record<string, string> = {
             en: "Please avoid pinging staff multiple times. Bumping the ticket doesn't speed up response times. We'll get to you as soon as possible.",
             fr: "Merci de ne pas mentionner le staff plusieurs fois. Relancer le ticket n'accélère pas le temps de réponse. Nous te répondrons dès que possible.",
             es: "Por favor evita mencionar al staff múltiples veces. Etiquetar no acelera el tiempo de respuesta. Te atenderemos lo antes posible."
           };
           await (channel as any).send(warnings[lang] ?? warnings.en);
        }
        // Do NOT continue processing the message to let AI ignore the spam? No, just warn and let AI handle as normal, or just return to ignore the ping. 
        // Returning to ignore is fine, effectively acting as an automod. But let's process it still.
      }
      lastStaffPings.set(channelId, now);
    }

    // If we were waiting for user's first message
    if (waitingForUser.has(channelId)) {
      waitingForUser.delete(channelId);

      // Detect language from their first message
      const lang = detectLanguage(data.content);
      this.ticketLanguages.set(channelId, lang);

      // Setup context with their message as the subject
      await this.setupAndRespond(channelId, data, lang, data.content);
      return;
    }

    let state = this.context.get(channelId);
    if (!state) {
      // Reconstruct state on restart
      this.context.getOrCreate(channelId, data.userId, data.guildId);
      state = this.context.get(channelId)!;
      
      const recoveredLang = detectLanguage(data.content);
      this.ticketLanguages.set(channelId, recoveredLang);
      
      try {
        const channel = await this.selfbot.channels.fetch(channelId).catch(() => null);
        if (channel?.isText()) {
          const pastMessages = await (channel as any).messages.fetch({ limit: 15 });
          const history = Array.from(pastMessages.values()).reverse() as any[];
          for (let i = 0; i < history.length; i++) {
            const msg = history[i];
            // Skip the very last message if it's exactly the one that triggered this event
            if (i === history.length - 1 && msg.author.id === data.userId && msg.content === data.content) {
              continue;
            }
            if (msg.author.id === this.selfbot.user?.id) {
              this.context.addMessage(channelId, "model", msg.content);
            } else if (!msg.author.bot && msg.author.id === data.userId) {
              this.context.addMessage(channelId, "user", msg.content);
            }
          }
        }
      } catch (err) {
        logger.error(`Failed to reconstruct history for ${channelId}:`, err);
      }
      
      try {
        const result = await this.ai.classifyText(
          data.content, 
          ["service_inquiry", "bug_report", "general_support"],
          undefined,
          { ticketId: channelId, guildId: data.guildId }
        );
        this.context.setTicketType(channelId, result.category, result.confidence);
      } catch {}

      const [memories, knowledge] = await Promise.all([
        this.memory.retrieveMemories(data.guildId, data.userId),
        this.getKnowledge(data.guildId)
      ]);
      this.context.setMemories(channelId, memories);
      const memoryContext = memories.length > 0 ? `You know this about the client:\n${memories.join("\n")}` : undefined;
      const systemPrompt = getTicketSystemPrompt(state.ticketType ?? "general_support", recoveredLang, memoryContext, knowledge);
      this.context.setSystemPrompt(channelId, systemPrompt);
    }

    // Update language if user switches
    const lang = detectLanguage(data.content);
    if (lang !== (this.ticketLanguages.get(channelId) ?? "en")) {
      this.ticketLanguages.set(channelId, lang);
      const knowledge = await this.getKnowledge(data.guildId);
      const systemPrompt = getTicketSystemPrompt(state.ticketType ?? "general_support", lang, undefined, knowledge);
      this.context.setSystemPrompt(channelId, systemPrompt);
    }

    // Check close intent BEFORE escalation
    if (this.detectCloseIntent(data.content)) {
      logger.ai(`Close intent detected in ${channelId}`);
      const channel = await this.selfbot.channels.fetch(channelId).catch(() => null);
      if (channel?.isText()) {
        // Check sentiment to decide farewell tone
        const sentimentData = this.getSentimentTemperature(channelId);
        const isGoodMood = !sentimentData || sentimentData.overall === "positive" || sentimentData.overall === "neutral";

        let farewell: string;
        if (isGoodMood) {
          // Positive/neutral: mention the review naturally
          const farewellsGood: Record<string, string> = {
            en: "glad i could help! if you've got a sec, feel free to leave a little review when you close, it really helps us out",
            fr: "content d'avoir pu t'aider ! si t'as 2sec hésite pas à laisser un petit avis en fermant, ça nous aide beaucoup",
            es: "me alegra haberte ayudado! si tienes un momento, déjanos una review al cerrar, nos ayuda mucho",
            de: "freut mich dass ich helfen konnte! wenn du kurz zeit hast, hinterlass gerne ne bewertung beim schließen",
            pt: "fico feliz em ter ajudado! se tiver um tempinho, deixa uma avaliação ao fechar, nos ajuda muito",
          };
          farewell = farewellsGood[lang] ?? farewellsGood.en!;
        } else {
          // Negative/frustrated: short farewell, no review mention
          const farewellsBad: Record<string, string> = {
            en: "alright, i'm closing this up. hope we can help you better next time",
            fr: "ok je ferme le ticket. j'espère qu'on pourra mieux t'aider la prochaine fois",
            es: "ok, cierro el ticket. espero poder ayudarte mejor la próxima vez",
            de: "ok, ich schließe das ticket. hoffe wir können dir nächstes mal besser helfen",
            pt: "ok, vou fechar o ticket. espero ajudar melhor da próxima vez",
          };
          farewell = farewellsBad[lang] ?? farewellsBad.en!;
        }

        const baseDelay = parseInt(process.env["AI_RESPONSE_DELAY"] ?? "3");
        await simulateTyping(channel, farewell.length, baseDelay);
        await (channel as any).send(farewell);
      }

      // Request close via bot (sends confirmation embed with buttons)
      try {
        await this.bridge.requestClose({
          channelId: data.channelId,
          guildId: data.guildId,
          userId: data.userId,
        });
      } catch (err) {
        logger.error("Failed to request close:", err);
      }
      return;
    }

    // Check escalation
    if (this.shouldEscalate(data.content, state.exchangeCount, state.confidence)) {
      await this.handleEscalation(data, lang);
      return;
    }

    // Sentiment check + track for summary temperature
    let sentiment = "neutral";
    let sentimentScore = 0.5;
    try {
      const result = await this.ai.analyzeSentiment(data.content, {
        ticketId: channelId,
        guildId: data.guildId,
      });
      sentiment = result.sentiment;
      sentimentScore = result.score;
    } catch {}

    // Track sentiment history for summaries
    if (!this.ticketSentiments.has(channelId)) {
      this.ticketSentiments.set(channelId, []);
    }
    this.ticketSentiments.get(channelId)!.push({
      sentiment,
      score: sentimentScore,
      timestamp: Date.now(),
    });

    // Only reduce confidence if content suggests AI doesn't know, not just rudeness
    if (sentiment === "frustrated") {
      this.context.reduceConfidence(channelId, 0.05);
    }

    // Only escalate on very low confidence (AI really can't handle this)
    if (state.confidence < MIN_CONFIDENCE_THRESHOLD && state.exchangeCount >= 3) {
      await this.handleEscalation(data, lang);
      return;
    }

    // Periodic memory refresh every 5 exchanges
    if (state.exchangeCount > 0 && state.exchangeCount % 5 === 0) {
      try {
        const memories = await this.memory.retrieveMemories(data.guildId, state.userId, data.content);
        this.context.setMemories(channelId, memories);
        // Rebuild system prompt with fresh memories
        const knowledge = await this.getKnowledge(data.guildId);
        const memoryContext = memories.length > 0 ? `You know this about the client:\n${memories.join("\n")}` : undefined;
        const systemPrompt = getTicketSystemPrompt(state.ticketType ?? "general_support", lang, memoryContext, knowledge);
        this.context.setSystemPrompt(channelId, systemPrompt);
      } catch {}
    }

    // Add message and respond
    this.context.addMessage(channelId, "user", data.content);

    const channel = await this.selfbot.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isText()) return;

    try {
      const taskType = this.determineTaskType(state.ticketType, state.exchangeCount);
      const model = this.router.getModel(taskType);

      const response = await this.ai.generateText(
        this.context.getFullSystemPrompt(channelId),
        this.context.getMessages(channelId),
        {
          model,
          temperature: this.router.getTemperature(taskType),
          maxTokens: this.router.getMaxTokens(taskType),
          taskType,
          ticketId: channelId,
          guildId: data.guildId,
        }
      );

      this.context.addMessage(channelId, "model", response.text);

      const baseDelay = parseInt(process.env["AI_RESPONSE_DELAY"] ?? "3");
      await simulateTyping(channel, response.text.length, baseDelay);

      await (channel as any).send(response.text);

      await this.processAIActions(response.text, data);

      // Dynamic Ticket Naming
      if (state.exchangeCount === 2) {
        try {
          const messagesSnippet = this.context.getMessages(channelId).slice(0, 4).map(m => m.content).join("\\n");
          const result = await this.ai.generateText(
            "Based on the conversation, generate a short, clean, descriptive channel name for this ticket (max 20 chars). Only use lowercase letters, numbers, and dashes. Example: esx-inventory-bug, tebex-refund, role-request, etc. Respond ONLY with the suggested name, nothing else.",
            [{ role: "user", content: messagesSnippet }],
            { temperature: 0.1, maxTokens: 20, taskType: "classification", ticketId: channelId, guildId: data.guildId }
          );
          
          let newName = result.text.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").substring(0, 30);
          if (newName && newName.length >= 3) {
            const ticketNumMatch = channel && "name" in channel ? (channel as any).name.match(/\\d+$/) : null;
            const suffix = ticketNumMatch ? `-${ticketNumMatch[0]}` : "";
            newName = `${newName}${suffix}`;
            logger.ai(`Renaming ticket ${channelId} to ${newName}`);
            await this.bridge.renameTicket({ channelId, guildId: data.guildId, newName });
          }
        } catch {
          // Ignore renaming failure
        }
      }

      // Proactive suggestion every 4 exchanges
      if (state.exchangeCount > 0 && state.exchangeCount % 4 === 0) {
        try {
          const lastMessages = this.context.getMessages(channelId).slice(-4)
            .map((m) => `[${m.role}]: ${m.content}`)
            .join("\n");
          const suggestion = await this.ai.classifyText(
            lastMessages,
            ["suggest_service", "suggest_specialist", "suggest_ticket", "no_suggestion"],
            "Should we proactively suggest something to help the user?"
          );
          if (suggestion.confidence >= 0.8 && suggestion.category !== "no_suggestion") {
            // Store the suggestion as context for the next system prompt rebuild
            const hint = `PROACTIVE HINT: Based on the conversation, consider suggesting: ${suggestion.category.replace("suggest_", "")}`;
            const currentPrompt = this.context.getFullSystemPrompt(channelId);
            this.context.setSystemPrompt(channelId, currentPrompt + `\n\n${hint}`);
          }
        } catch {}
      }
    } catch (err) {
      logger.error("Failed to respond:", err);
    }
  }

  /**
   * Ticket closed - save memories
   */
  async handleTicketClose(data: TicketCloseEvent): Promise<void> {
    waitingForUser.delete(data.channelId);
    staffBackedOff.delete(data.channelId);

    const state = this.context.get(data.channelId);
    if (!state) return;

    logger.ai(`Ticket closed in ${data.channelId}`);

    // Close budget tracking for this ticket
    const budget = this.ai.getBudget();
    const ticketCost = budget.closeTicket(data.channelId);
    if (ticketCost) {
      try {
        await this.bridge.saveTicketCost({
          ticketId: data.channelId,
          channelId: data.channelId,
          guildId: data.guildId,
          totalCost: ticketCost.totalCost,
          totalCalls: ticketCost.totalCalls,
          modelsUsed: [...ticketCost.modelsUsed],
        });
      } catch (err) {
        logger.error("Failed to save ticket cost:", err);
      }
    }

    const messages = state.messages.map((m) => ({ role: m.role, content: m.content }));
    await this.memory.createMemoriesFromConversation(data.guildId, state.userId, messages);

    this.context.remove(data.channelId);
    this.ticketLanguages.delete(data.channelId);
    this.ticketSentiments.delete(data.channelId);
  }

  getActiveCount(): number {
    return this.context.getActiveCount();
  }

  /**
   * Get sentiment temperature for a ticket (for summaries)
   * Returns: { overall: "positive"|"neutral"|"negative"|"frustrated", avgScore: number, trend: "improving"|"stable"|"declining" }
   */
  getSentimentTemperature(channelId: string): { overall: string; avgScore: number; trend: string } | null {
    const sentiments = this.ticketSentiments.get(channelId);
    if (!sentiments || sentiments.length === 0) return null;

    const avgScore = sentiments.reduce((sum, s) => sum + s.score, 0) / sentiments.length;

    // Determine overall sentiment
    let overall = "neutral";
    if (avgScore >= 0.7) overall = "positive";
    else if (avgScore <= 0.3) overall = "negative";

    const frustrated = sentiments.filter((s) => s.sentiment === "frustrated").length;
    if (frustrated > sentiments.length * 0.3) overall = "frustrated";

    // Determine trend (compare first half vs second half)
    let trend = "stable";
    if (sentiments.length >= 4) {
      const mid = Math.floor(sentiments.length / 2);
      const firstHalf = sentiments.slice(0, mid).reduce((s, v) => s + v.score, 0) / mid;
      const secondHalf = sentiments.slice(mid).reduce((s, v) => s + v.score, 0) / (sentiments.length - mid);

      if (secondHalf - firstHalf > 0.15) trend = "improving";
      else if (firstHalf - secondHalf > 0.15) trend = "declining";
    }

    return { overall, avgScore, trend };
  }

  /**
   * Get conversation context for summary generation
   */
  getConversationContext(channelId: string) {
    return this.context.get(channelId);
  }

  // ===== Private =====

  /**
   * Fetch knowledge base entries for a guild (cached 5 min)
   */
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

  /**
   * Setup context for a ticket and send first AI response
   */
  private async setupAndRespond(
    channelId: string,
    data: TicketNewEvent | TicketMessageEvent,
    lang: SupportedLanguage,
    userMessage: string
  ): Promise<void> {
    const guildId = data.guildId;
    const userId = data.userId;

    // Classify
    const categories = ["service_inquiry", "bug_report", "role_request", "partnership", "general_support"];
    let ticketType = "general_support";
    let confidence = 0.7;

    try {
      const result = await this.ai.classifyText(userMessage, categories);
      ticketType = result.category;
      confidence = result.confidence;
    } catch {}

    this.context.setTicketType(channelId, ticketType, confidence);

    // Get memories + knowledge
    const [memories, knowledge] = await Promise.all([
      this.memory.retrieveMemories(guildId, userId),
      this.getKnowledge(guildId),
    ]);
    this.context.setMemories(channelId, memories);

    // Build prompt with knowledge
    const memoryContext = memories.length > 0 ? `You know this about the client:\n${memories.join("\n")}` : undefined;
    const systemPrompt = getTicketSystemPrompt(ticketType, lang, memoryContext, knowledge);
    this.context.setSystemPrompt(channelId, systemPrompt);

    // Add user message
    this.context.addMessage(channelId, "user", userMessage);

    // Get channel
    const channel = await this.selfbot.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isText()) return;

    try {
      const model = this.router.getModel("quick_response");

      const response = await this.ai.generateText(
        this.context.getFullSystemPrompt(channelId),
        this.context.getMessages(channelId),
        {
          model,
          temperature: 0.9,
          maxTokens: 256,
          taskType: "quick_response",
          ticketId: channelId,
          guildId,
        }
      );

      this.context.addMessage(channelId, "model", response.text);

      const baseDelay = parseInt(process.env["AI_RESPONSE_DELAY"] ?? "3");
      await simulateTyping(channel, response.text.length, baseDelay + Math.random() * 3);

      await (channel as any).send(response.text);
      logger.ai(`Responded in ${channelId}`);
    } catch (err: any) {
      if (err.code === 10003) {
        logger.ai(`Responded failed (Ticket closed: Unknown Channel) in ${channelId}`);
      } else {
        logger.error("Failed to respond:", err);
      }
    }
  }

  /**
   * Detect if user wants to close the ticket
   */
  private detectCloseIntent(content: string): boolean {
    const lower = content.toLowerCase().trim();

    // Direct keyword match
    if (CLOSE_KEYWORDS.some((kw) => lower.includes(kw))) return true;

    // Short thank-you messages that signal they're done
    if (lower.length < 30 && /^(merci|thanks|thx|ty|thks|ok merci|ok thanks|parfait merci|perfect thanks)[\s!.]*$/i.test(lower)) {
      return true;
    }

    return false;
  }

  /**
   * Determine if AI is confident enough to resume after staff backed off
   */
  private async canAIResume(content: string, channelId: string): Promise<boolean> {
    const state = this.context.get(channelId);
    if (!state) return false;

    // Only resume if we had good confidence before
    if (state.confidence < 0.75) return false;

    // Ask the AI to classify if the new question is within scope
    try {
      const result = await this.ai.classifyText(
        content,
        ["can_handle", "needs_human"],
        `The AI was handling a ${state.ticketType} ticket and staff took over. The user sent a new message. Can the AI resume handling this or does it still need human attention?`
      );

      // Only resume if VERY confident
      return result.category === "can_handle" && result.confidence >= 0.85;
    } catch {
      return false;
    }
  }

  private shouldEscalate(content: string, exchangeCount: number, confidence: number): boolean {
    const lower = content.toLowerCase();
    // Only escalate on explicit keyword match (user actively asking for human/refund)
    if (ESCALATION_KEYWORDS.some((kw) => lower.includes(kw))) return true;
    // Escalate after many exchanges AND low confidence (AI is clearly struggling)
    if (exchangeCount >= MAX_EXCHANGES_BEFORE_ESCALATION && confidence < 0.6) return true;
    return false;
  }

  private async handleEscalation(data: TicketMessageEvent, lang: SupportedLanguage, reason: string | null = null, specialtyNeeded?: string, silent: boolean = false): Promise<void> {
    logger.ai(`Escalating ticket in ${data.channelId}`);
    this.context.markEscalated(data.channelId);

    const state = this.context.get(data.channelId);
    const ticketType = state?.ticketType ?? "general_support";

    if (!specialtyNeeded) {
      if (ticketType === "bug_report") specialtyNeeded = "developer";
      else if (ticketType === "partnership") specialtyNeeded = "manager";
    }

    let teamMembers: Array<{ userId: string; name: string; role: string; specialties: string[]; available: boolean }> = [];
    try {
      teamMembers = await this.bridge.queryTeamMembers({
        guildId: data.guildId,
        specialty: specialtyNeeded,
        available: true,
      });
    } catch {}

    const assignee = teamMembers[0];
    const assigneeName = assignee ? `<@${assignee.userId}>` : "the team";

    let level: "normal" | "high" | "critical" = "normal";
    const lower = data.content.toLowerCase();
    if (lower.includes("urgent") || lower.includes("urgente") || lower.includes("remboursement") || lower.includes("refund")) {
      level = "high";
    }

    if (!silent) {
      const channel = await this.selfbot.channels.fetch(data.channelId).catch(() => null);
      if (channel?.isText()) {
        await (channel as any).send(getEscalateMessage(assigneeName, lang));
      }
    }

    // Track the escalation for potential re-engagement
    if (assignee) {
      staffBackedOff.set(data.channelId, {
        staffId: assignee.userId,
        lastStaffMsg: Date.now(),
        lastUserMsg: 0,
      });
    }

    try {
      await this.bridge.escalate({
        ticketId: 0,
        channelId: data.channelId,
        guildId: data.guildId,
        level,
        reason: reason ?? `AI escalation: ${ticketType} - exchange #${state?.exchangeCount ?? 0}`,
        specialtyNeeded,
      });
    } catch (err) {
      logger.error("Failed to escalate:", err);
    }
  }

  private determineTaskType(ticketType: string | null, exchangeCount: number): "quick_response" | "conversation" | "complex_analysis" {
    if (exchangeCount <= 1 && ticketType !== "partnership" && ticketType !== "bug_report") {
      return "quick_response";
    }
    if (ticketType === "partnership" || (ticketType === "bug_report" && exchangeCount > 2)) {
      return "complex_analysis";
    }
    return "conversation";
  }

  private async processAIActions(response: string, data: TicketMessageEvent): Promise<void> {
    if (!this.actionParser) {
      // Fallback to basic string matching if no actionParser
      const lower = response.toLowerCase();
      if (lower.includes("je note") || lower.includes("je crée") ||
          lower.includes("i'll create") || lower.includes("i'll note") ||
          lower.includes("let me note")) {
        try {
          await this.bridge.addTodo({
            guildId: data.guildId,
            title: `Ticket: ${data.content.substring(0, 100)}`,
            description: `Channel ${data.channelId}, user ${data.userId}`,
            priority: "normal",
          });
        } catch {}
      }
      return;
    }

    try {
      const state = this.context.get(data.channelId);
      const actions = await this.actionParser.detectActions(
        this.context.getMessages(data.channelId),
        response,
        {
          channelId: data.channelId,
          guildId: data.guildId,
          userId: data.userId,
          ticketType: state?.ticketType ?? undefined,
        }
      );

      for (const action of actions) {
        if (action.confidence < 0.7) continue;
        switch (action.type) {
          case "todo": {
            const todoData = action.data as { title: string; description?: string; priority?: string };
            await this.bridge.addTodo({
              guildId: data.guildId,
              title: todoData.title,
              description: todoData.description,
              priority: (todoData.priority as any) ?? "normal",
            });
            break;
          }
          case "reminder": {
            const reminderData = action.data as { content: string; delayMs: number };
            await this.bridge.createReminder({
              guildId: data.guildId,
              userId: data.userId,
              content: reminderData.content,
              channelId: data.channelId,
              triggerAt: new Date(Date.now() + reminderData.delayMs).toISOString(),
              sourceType: "ticket",
              sourceId: data.channelId,
            });
            break;
          }
          case "escalate": {
            const escalateData = action.data as { reason: string; specialtyNeeded?: string };
            const lang = this.ticketLanguages.get(data.channelId) ?? "en";
            
            // Check if the AI's natural response already sounds like an escalation
            // to avoid sending a redundant canned message.
            const lowerResponse = response.toLowerCase();
            const alreadyAwaitingTeam = 
              lowerResponse.includes("team") || 
              lowerResponse.includes("manager") || 
              lowerResponse.includes("someone") ||
              lowerResponse.includes("ask") ||
              lowerResponse.includes("attends") ||
              lowerResponse.includes("un instant") ||
              lowerResponse.includes("patience");

            // Call handleEscalation with silence if AI already acknowledged it.
            await this.handleEscalation(data, lang, escalateData.reason, escalateData.specialtyNeeded, alreadyAwaitingTeam);
            break;
          }
          case "close": {
            logger.ai(`AI decided to close the ticket in ${data.channelId}`);
            try {
              await this.bridge.requestClose({
                channelId: data.channelId,
                guildId: data.guildId,
                userId: data.userId,
              });
            } catch (err) {
              logger.error(`Failed to request close for AI action in ${data.channelId}:`, err);
            }
            break;
          }
        }
      }
    } catch (err) {
      logger.error("Failed to process AI actions:", err);
    }
  }
}
