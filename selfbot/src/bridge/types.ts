// ===== Server → AI Client Events =====

export interface TicketNewEvent {
  id: number;
  channelId: string;
  guildId: string;
  userId: string;
  category: string | null;
  subject: string | null;
  number: number;
}

export interface TicketMessageEvent {
  ticketId: number;
  channelId: string;
  guildId: string;
  content: string;
  userId: string;
  username: string;
  isStaff: boolean;
  isBot: boolean;
  attachments?: Array<{ url: string; contentType: string | null }>;
}

export interface TicketCloseEvent {
  ticketId: number;
  channelId: string;
  guildId: string;
  closedBy: string;
}

export interface ReviewSubmittedEvent {
  ticketId: number;
  guildId: string;
  userId: string;
  rating: number;
  review: string;
}

// ===== AI Client → Server Actions =====

export interface AssignRoleAction {
  guildId: string;
  userId: string;
  roleId: string;
}

export interface CloseTicketAction {
  channelId: string;
  guildId: string;
}

export interface RenameTicketAction {
  channelId: string;
  guildId: string;
  newName: string;
}

export interface SendAsBotAction {
  channelId: string;
  content?: string;
  embed?: {
    title?: string;
    description: string;
    color?: number;
    footer?: string;
  };
}

export interface AddTodoAction {
  guildId: string;
  title: string;
  description?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  assigneeId?: string;
  fromTicketId?: number;
}

export interface EscalateAction {
  ticketId: number;
  channelId: string;
  guildId: string;
  level: "normal" | "high" | "critical";
  reason: string;
  specialtyNeeded?: string;
}

export interface AcceptReviewAction {
  ticketId: number;
  guildId: string;
}

export interface RequestReviewAction {
  ticketId: number;
  guildId: string;
  userId: string;
}

export interface RequestCloseAction {
  channelId: string;
  guildId: string;
  userId: string;
  reason?: string;
}

export interface TrackAICostAction {
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

export interface SaveTicketCostAction {
  ticketId: string;
  channelId: string;
  guildId: string;
  totalCost: number;
  totalCalls: number;
  modelsUsed: string[];
}

export interface SaveDaySummaryAction {
  date: string;
  totalSpend: number;
  totalRequests: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCached: number;
  avgCostPerTicket: number;
  byModel: string; // JSON stringified
  byTaskType: string; // JSON stringified
}

// ===== DM Actions =====

export interface CreateDMThreadAction {
  channelId: string; // AI_DM_LOG_CHANNEL
  userId: string;
  username: string;
  threadName: string; // "username - 2026-02-20"
}

export interface SendToThreadAction {
  threadId: string;
  content?: string;
  embed?: {
    title?: string;
    description: string;
    color?: number;
    footer?: string;
    author?: string;
  };
}

export interface DMThreadReplyEvent {
  threadId: string;
  content: string;
  userId: string; // staff userId
  username: string;
}

// ===== Reminder Actions =====

export interface CreateReminderAction {
  guildId?: string;
  userId: string;
  targetUserId?: string;
  content: string;
  channelId?: string;
  triggerAt: string; // ISO
  sourceType: "ticket" | "dm" | "manual";
  sourceId?: string;
}

// ===== Memory Actions =====

export interface CreateMemoryAction {
  guildId: string;
  userId: string;
  type: string;
  content: string;
  importance: number;
}

// ===== AI Client → Server Queries =====

export interface TicketQuery {
  ticketId?: number;
  channelId?: string;
}

export interface ServicesQuery {
  guildId: string;
  category?: string;
}

export interface TeamMembersQuery {
  guildId: string;
  specialty?: string;
  available?: boolean;
}

export interface UserHistoryQuery {
  guildId: string;
  userId: string;
}

export interface GenerateSummaryQuery {
  channelId: string;
  guildId: string;
  ticketId: number;
  messages: Array<{ role: string; content: string }>;
  previousSummary: string | null;
}

export interface KnowledgeQuery {
  guildId: string;
  category?: string;
}

export interface KnowledgeEntry {
  category: string;
  key: string;
  value: string;
}

export interface TicketSummaryResponse {
  summary: string;
  keyPoints: string[];
  suggestions: string[];
  sentiment: string;
  trend: string;
}

// ===== Query Responses =====

export interface TicketInfo {
  id: number;
  number: number;
  channelId: string;
  userId: string;
  guildId: string;
  category: string | null;
  subject: string | null;
  status: string;
  priority: string;
  claimedBy: string | null;
  createdAt: string;
}

export interface ServiceInfo {
  id: number;
  name: string;
  emoji: string | null;
  description: string;
  price: string | null;
  features: string[];
  category: string;
}

export interface TeamMemberInfo {
  id: number;
  userId: string;
  name: string;
  role: string;
  specialties: string[];
  available: boolean;
}

export interface UserHistoryInfo {
  tickets: Array<{
    id: number;
    number: number;
    category: string | null;
    subject: string | null;
    status: string;
    createdAt: string;
  }>;
  memories: Array<{
    type: string;
    content: string;
    importance: number;
    createdAt: string;
  }>;
}

// ===== Socket Event Maps =====

export interface ServerToAIEvents {
  "ticket:new": (data: TicketNewEvent) => void;
  "ticket:message": (data: TicketMessageEvent) => void;
  "ticket:close": (data: TicketCloseEvent) => void;
  "review:submitted": (data: ReviewSubmittedEvent) => void;
  "dm:threadReply": (data: DMThreadReplyEvent) => void;
  "reminder:fire": (data: { reminderId: number; userId: string; content: string; channelId?: string }) => void;
}

export interface AIToServerEvents {
  "action:assignRole": (data: AssignRoleAction, callback: (result: { success: boolean; error?: string }) => void) => void;
  "action:closeTicket": (data: CloseTicketAction, callback: (result: { success: boolean; error?: string }) => void) => void;
  "action:renameTicket": (data: RenameTicketAction, callback: (result: { success: boolean; error?: string }) => void) => void;
  "action:sendAsBot": (data: SendAsBotAction, callback: (result: { success: boolean; error?: string }) => void) => void;
  "action:addTodo": (data: AddTodoAction, callback: (result: { success: boolean; todoId?: number; error?: string }) => void) => void;
  "action:escalate": (data: EscalateAction, callback: (result: { success: boolean; error?: string }) => void) => void;
  "action:acceptReview": (data: AcceptReviewAction, callback: (result: { success: boolean; error?: string }) => void) => void;
  "action:requestReview": (data: RequestReviewAction, callback: (result: { success: boolean; error?: string }) => void) => void;
  "action:requestClose": (data: RequestCloseAction, callback: (result: { success: boolean; error?: string }) => void) => void;
  "action:trackAICost": (data: TrackAICostAction, callback: (result: { success: boolean; error?: string }) => void) => void;
  "action:saveTicketCost": (data: SaveTicketCostAction, callback: (result: { success: boolean; error?: string }) => void) => void;
  "action:saveDaySummary": (data: SaveDaySummaryAction, callback: (result: { success: boolean; error?: string }) => void) => void;
  "action:createDMThread": (data: CreateDMThreadAction, callback: (result: { success: boolean; threadId?: string; error?: string }) => void) => void;
  "action:sendToThread": (data: SendToThreadAction, callback: (result: { success: boolean; error?: string }) => void) => void;
  "action:createReminder": (data: CreateReminderAction, callback: (result: { success: boolean; reminderId?: number; error?: string }) => void) => void;
  "action:createMemory": (data: CreateMemoryAction, callback: (result: { success: boolean; memoryId?: number; error?: string }) => void) => void;
  "query:ticket": (data: TicketQuery, callback: (result: TicketInfo | null) => void) => void;
  "query:services": (data: ServicesQuery, callback: (result: ServiceInfo[]) => void) => void;
  "query:teamMembers": (data: TeamMembersQuery, callback: (result: TeamMemberInfo[]) => void) => void;
  "query:userHistory": (data: UserHistoryQuery, callback: (result: UserHistoryInfo) => void) => void;
  "query:generateSummary": (data: GenerateSummaryQuery, callback: (result: TicketSummaryResponse) => void) => void;
  "query:knowledge": (data: KnowledgeQuery, callback: (result: KnowledgeEntry[]) => void) => void;
}
