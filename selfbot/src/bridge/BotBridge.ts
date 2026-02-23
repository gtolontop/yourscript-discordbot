import { io, Socket } from "socket.io-client";
import { logger } from "../utils/logger.js";
import type {
  ServerToAIEvents,
  AIToServerEvents,
  TicketNewEvent,
  TicketMessageEvent,
  TicketCloseEvent,
  ReviewSubmittedEvent,
  DMThreadReplyEvent,
  AssignRoleAction,
  CloseTicketAction,
  SendAsBotAction,
  AddTodoAction,
  EscalateAction,
  AcceptReviewAction,
  RequestReviewAction,
  RequestCloseAction,
  TrackAICostAction,
  SaveTicketCostAction,
  SaveDaySummaryAction,
  CreateDMThreadAction,
  SendToThreadAction,
  CreateReminderAction,
  CreateMemoryAction,
  RenameTicketAction,
  GenerateSummaryQuery,
  TicketSummaryResponse,
  TicketQuery,
  TicketInfo,
  ServicesQuery,
  ServiceInfo,
  TeamMembersQuery,
  TeamMemberInfo,
  UserHistoryQuery,
  UserHistoryInfo,
  KnowledgeQuery,
  KnowledgeEntry,
} from "./types.js";

type EventHandler<T> = (data: T) => void | Promise<void>;
type QueryHandler<T, R> = (data: T) => Promise<R>;

export class BotBridge {
  private socket: Socket<ServerToAIEvents, AIToServerEvents> | null = null;
  private handlers = new Map<string, EventHandler<any>>();
  private queryHandlers = new Map<string, QueryHandler<any, any>>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 50;

  constructor(
    private serverUrl: string,
    private secret: string
  ) {}

  connect(): void {
    this.socket = io(`${this.serverUrl}/ai`, {
      auth: { secret: this.secret },
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.socket.on("connect", () => {
      logger.bridge("Connected to bot server");
      this.reconnectAttempts = 0;
    });

    this.socket.on("disconnect", (reason) => {
      logger.bridge(`Disconnected from bot server: ${reason}`);
    });

    this.socket.on("connect_error", (error) => {
      this.reconnectAttempts++;
      if (this.reconnectAttempts <= 3) {
        logger.error(`Connection error: ${error.message}`);
      }
    });

    // Bind server events to registered handlers
    this.socket.on("ticket:new", (data) => this.emit("ticket:new", data));
    this.socket.on("ticket:message", (data) => this.emit("ticket:message", data));
    this.socket.on("ticket:close", (data) => this.emit("ticket:close", data));
    this.socket.on("review:submitted", (data) => this.emit("review:submitted", data));
    (this.socket as any).on("dm:threadReply", (data: any) => this.emit("dm:threadReply", data));
    (this.socket as any).on("reminder:fire", (data: any) => this.emit("reminder:fire", data));

    // Bind server queries (server asks selfbot, selfbot responds with callback)
    (this.socket as any).on("query:generateSummary", async (data: any, callback: any) => {
      const handler = this.queryHandlers.get("query:generateSummary");
      if (handler) {
        try {
          const result = await handler(data);
          callback(result);
        } catch (err) {
          logger.error("Error handling query:generateSummary:", err);
          callback({ summary: "Failed to generate summary", keyPoints: [], suggestions: [], sentiment: "neutral", trend: "stable" });
        }
      } else {
        callback({ summary: "No handler registered", keyPoints: [], suggestions: [], sentiment: "neutral", trend: "stable" });
      }
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  // ===== Event Registration =====

  on(event: "ticket:new", handler: EventHandler<TicketNewEvent>): void;
  on(event: "ticket:message", handler: EventHandler<TicketMessageEvent>): void;
  on(event: "ticket:close", handler: EventHandler<TicketCloseEvent>): void;
  on(event: "review:submitted", handler: EventHandler<ReviewSubmittedEvent>): void;
  on(event: "dm:threadReply", handler: EventHandler<DMThreadReplyEvent>): void;
  on(event: "reminder:fire", handler: EventHandler<{ reminderId: number; userId: string; content: string; channelId?: string }>): void;
  on(event: string, handler: EventHandler<any>): void {
    this.handlers.set(event, handler);
  }

  /**
   * Register a handler for server-initiated queries (server asks, selfbot responds)
   */
  onQuery<T, R>(event: string, handler: QueryHandler<T, R>): void {
    this.queryHandlers.set(event, handler);
  }

  private emit(event: string, data: any): void {
    const handler = this.handlers.get(event);
    if (handler) {
      Promise.resolve(handler(data)).catch((err) => {
        logger.error(`Error in handler for ${event}:`, err);
      });
    }
  }

  // ===== Actions (with callback/ack) =====

  async assignRole(data: AssignRoleAction): Promise<{ success: boolean; error?: string }> {
    return this.callAction("action:assignRole", data);
  }

  async closeTicket(data: CloseTicketAction): Promise<{ success: boolean; error?: string }> {
    return this.callAction("action:closeTicket", data);
  }

  async renameTicket(data: RenameTicketAction): Promise<{ success: boolean; error?: string }> {
    return this.callAction("action:renameTicket", data);
  }

  async sendAsBot(data: SendAsBotAction): Promise<{ success: boolean; error?: string }> {
    return this.callAction("action:sendAsBot", data);
  }

  async addTodo(data: AddTodoAction): Promise<{ success: boolean; todoId?: number; error?: string }> {
    return this.callAction("action:addTodo", data);
  }

  async escalate(data: EscalateAction): Promise<{ success: boolean; error?: string }> {
    return this.callAction("action:escalate", data);
  }

  async acceptReview(data: AcceptReviewAction): Promise<{ success: boolean; error?: string }> {
    return this.callAction("action:acceptReview", data);
  }

  async requestReview(data: RequestReviewAction): Promise<{ success: boolean; error?: string }> {
    return this.callAction("action:requestReview", data);
  }

  async requestClose(data: RequestCloseAction): Promise<{ success: boolean; error?: string }> {
    return this.callAction("action:requestClose", data);
  }

  async trackAICost(data: TrackAICostAction): Promise<{ success: boolean; error?: string }> {
    return this.callAction("action:trackAICost", data);
  }

  async saveTicketCost(data: SaveTicketCostAction): Promise<{ success: boolean; error?: string }> {
    return this.callAction("action:saveTicketCost", data);
  }

  async saveDaySummary(data: SaveDaySummaryAction): Promise<{ success: boolean; error?: string }> {
    return this.callAction("action:saveDaySummary", data);
  }

  async createDMThread(data: CreateDMThreadAction): Promise<{ success: boolean; threadId?: string; error?: string }> {
    return this.callAction("action:createDMThread", data);
  }

  async sendToThread(data: SendToThreadAction): Promise<{ success: boolean; error?: string }> {
    return this.callAction("action:sendToThread", data);
  }

  async createReminder(data: CreateReminderAction): Promise<{ success: boolean; reminderId?: number; error?: string }> {
    return this.callAction("action:createReminder", data);
  }

  async createMemory(data: CreateMemoryAction): Promise<{ success: boolean; memoryId?: number; error?: string }> {
    return this.callAction("action:createMemory", data);
  }

  // ===== Queries =====

  async queryTicket(data: TicketQuery): Promise<TicketInfo | null> {
    return this.callAction("query:ticket", data);
  }

  async queryServices(data: ServicesQuery): Promise<ServiceInfo[]> {
    return this.callAction("query:services", data);
  }

  async queryTeamMembers(data: TeamMembersQuery): Promise<TeamMemberInfo[]> {
    return this.callAction("query:teamMembers", data);
  }

  async queryUserHistory(data: UserHistoryQuery): Promise<UserHistoryInfo> {
    return this.callAction("query:userHistory", data);
  }

  async queryKnowledge(data: KnowledgeQuery): Promise<KnowledgeEntry[]> {
    return this.callAction("query:knowledge", data);
  }

  // ===== Private Helpers =====

  private callAction<T>(event: string, data: any): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error("Not connected to bot server"));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${event} response`));
      }, 15000);

      (this.socket as any).emit(event, data, (result: T) => {
        clearTimeout(timeout);
        resolve(result);
      });
    });
  }
}
