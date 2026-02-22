import type {
  GuildConfig,
  Warn,
  Ticket,
  TicketCategory,
  TicketBlacklist,
  Giveaway,
  Suggestion,
  ReactionRole,
  AutoRole,
  EmbedTemplate,
  Reminder,
  BotConfig,
  Transcript,
  User,
  AddXpResult,
} from "./types.js";

/**
 * HTTP client for the Rust backend API.
 * Replaces all direct Prisma calls in the bot.
 */
export class BackendClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "X-API-Key": this.apiKey,
      "Content-Type": "application/json",
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Backend API error ${response.status}: ${error}`);
    }

    return response.json() as Promise<T>;
  }

  private get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  private post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  private put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  private delete<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }

  // ─── Guild Config ───────────────────────────────────────────────────

  async getGuildConfig(guildId: string): Promise<GuildConfig> {
    return this.get(`/api/v1/guilds/${guildId}/config`);
  }

  async updateGuildConfig(
    guildId: string,
    updates: Partial<GuildConfig>,
  ): Promise<GuildConfig> {
    return this.put(`/api/v1/guilds/${guildId}/config`, updates);
  }

  // ─── Tickets ────────────────────────────────────────────────────────

  async createTicket(data: {
    guildId: string;
    number: number;
    channelId: string;
    userId: string;
    category?: string;
    subject?: string;
  }): Promise<Ticket> {
    return this.post(`/api/v1/bot/guilds/${data.guildId}/tickets`, {
      number: data.number,
      channel_id: data.channelId,
      user_id: data.userId,
      category: data.category,
      subject: data.subject,
    });
  }

  async getTicket(guildId: string, ticketId: number): Promise<Ticket> {
    return this.get(`/api/v1/guilds/${guildId}/tickets/${ticketId}`);
  }

  async listTickets(
    guildId: string,
    status?: string,
  ): Promise<{ tickets: Ticket[]; total: number }> {
    const params = status ? `?status=${status}` : "";
    return this.get(`/api/v1/guilds/${guildId}/tickets${params}`);
  }

  async closeTicket(
    guildId: string,
    ticketId: number,
    closedBy: string,
  ): Promise<void> {
    await this.post(`/api/v1/guilds/${guildId}/tickets/${ticketId}/close`, {
      closed_by: closedBy,
    });
  }

  async claimTicket(guildId: string, ticketId: number): Promise<void> {
    await this.post(`/api/v1/guilds/${guildId}/tickets/${ticketId}/claim`);
  }

  async updateTicketPriority(
    guildId: string,
    ticketId: number,
    priority: string,
  ): Promise<void> {
    await this.put(`/api/v1/guilds/${guildId}/tickets/${ticketId}/priority`, {
      priority,
    });
  }

  async getTicketCategories(guildId: string): Promise<TicketCategory[]> {
    return this.get(`/api/v1/guilds/${guildId}/ticket-categories`);
  }

  async createTicketCategory(
    guildId: string,
    data: { name: string; emoji?: string; description?: string },
  ): Promise<TicketCategory> {
    return this.post(`/api/v1/guilds/${guildId}/ticket-categories`, data);
  }

  async deleteTicketCategory(
    guildId: string,
    categoryId: number,
  ): Promise<void> {
    await this.delete(`/api/v1/guilds/${guildId}/ticket-categories/${categoryId}`);
  }

  async checkTicketBlacklist(
    guildId: string,
    userId: string,
  ): Promise<TicketBlacklist | null> {
    const list: TicketBlacklist[] = await this.get(
      `/api/v1/guilds/${guildId}/ticket-blacklist`,
    );
    return list.find((b) => b.user_id === userId) ?? null;
  }

  async addTicketBlacklist(
    guildId: string,
    data: { userId: string; reason?: string; addedBy: string },
  ): Promise<void> {
    await this.post(`/api/v1/guilds/${guildId}/ticket-blacklist`, {
      user_id: data.userId,
      reason: data.reason,
      added_by: data.addedBy,
    });
  }

  async removeTicketBlacklist(
    guildId: string,
    blacklistId: number,
  ): Promise<void> {
    await this.delete(
      `/api/v1/guilds/${guildId}/ticket-blacklist/${blacklistId}`,
    );
  }

  // ─── Warns ──────────────────────────────────────────────────────────

  async addWarn(data: {
    guildId: string;
    targetUserId: string;
    moderatorId: string;
    reason: string;
  }): Promise<Warn> {
    return this.post(`/api/v1/bot/guilds/${data.guildId}/warns`, {
      target_user_id: data.targetUserId,
      moderator_id: data.moderatorId,
      reason: data.reason,
    });
  }

  async getWarns(guildId: string, userId?: string): Promise<Warn[]> {
    if (userId) {
      return this.get(`/api/v1/guilds/${guildId}/warns/user/${userId}`);
    }
    return this.get(`/api/v1/guilds/${guildId}/warns`);
  }

  async deleteWarn(guildId: string, warnId: number): Promise<void> {
    await this.delete(`/api/v1/guilds/${guildId}/warns/${warnId}`);
  }

  async clearWarns(guildId: string, userId: string): Promise<void> {
    await this.delete(`/api/v1/guilds/${guildId}/warns/user/${userId}`);
  }

  // ─── XP / Leveling ─────────────────────────────────────────────────

  async addXp(userId: string, amount: number): Promise<AddXpResult> {
    return this.post("/api/v1/bot/xp", { user_id: userId, amount });
  }

  async getUser(userId: string): Promise<User | null> {
    try {
      return await this.get(`/api/v1/guilds/_/leaderboard?user_id=${userId}`);
    } catch {
      return null;
    }
  }

  // ─── Giveaways ─────────────────────────────────────────────────────

  async enterGiveaway(
    giveawayId: number,
    userId: string,
  ): Promise<{ entered: boolean; reason?: string }> {
    return this.post("/api/v1/bot/giveaway-enter", {
      giveaway_id: giveawayId,
      user_id: userId,
    });
  }

  async getGiveaways(guildId: string): Promise<Giveaway[]> {
    return this.get(`/api/v1/guilds/${guildId}/giveaways`);
  }

  async createGiveaway(
    guildId: string,
    data: {
      channelId: string;
      messageId: string;
      hostId: string;
      prize: string;
      winners: number;
      requiredRole?: string;
      endsAt: string;
    },
  ): Promise<Giveaway> {
    return this.post(`/api/v1/guilds/${guildId}/giveaways`, {
      channel_id: data.channelId,
      message_id: data.messageId,
      host_id: data.hostId,
      prize: data.prize,
      winners: data.winners,
      required_role: data.requiredRole,
      ends_at: data.endsAt,
    });
  }

  async endGiveaway(guildId: string, giveawayId: number): Promise<void> {
    await this.post(`/api/v1/guilds/${guildId}/giveaways/${giveawayId}/end`);
  }

  async rerollGiveaway(guildId: string, giveawayId: number): Promise<void> {
    await this.post(`/api/v1/guilds/${guildId}/giveaways/${giveawayId}/reroll`);
  }

  // ─── Suggestions ───────────────────────────────────────────────────

  async createSuggestion(
    guildId: string,
    data: { userId: string; messageId: string; content: string },
  ): Promise<Suggestion> {
    return this.post(`/api/v1/guilds/${guildId}/suggestions`, data);
  }

  async voteSuggestion(
    guildId: string,
    suggestionId: number,
    vote: "up" | "down",
  ): Promise<void> {
    await this.post(
      `/api/v1/guilds/${guildId}/suggestions/${suggestionId}/vote`,
      { vote },
    );
  }

  async approveSuggestion(
    guildId: string,
    suggestionId: number,
    staffId: string,
    reason?: string,
  ): Promise<void> {
    await this.post(
      `/api/v1/guilds/${guildId}/suggestions/${suggestionId}/approve`,
      { staff_id: staffId, reason },
    );
  }

  async rejectSuggestion(
    guildId: string,
    suggestionId: number,
    staffId: string,
    reason?: string,
  ): Promise<void> {
    await this.post(
      `/api/v1/guilds/${guildId}/suggestions/${suggestionId}/reject`,
      { staff_id: staffId, reason },
    );
  }

  // ─── Reaction Roles ────────────────────────────────────────────────

  async getReactionRoles(guildId: string): Promise<ReactionRole[]> {
    return this.get(`/api/v1/guilds/${guildId}/reaction-roles`);
  }

  async createReactionRoles(
    guildId: string,
    data: {
      channelId: string;
      messageId: string;
      roles: Array<{
        roleId: string;
        emoji: string;
        label?: string;
        style?: string;
      }>;
    },
  ): Promise<void> {
    await this.post(`/api/v1/guilds/${guildId}/reaction-roles`, {
      channel_id: data.channelId,
      message_id: data.messageId,
      roles: data.roles.map((r) => ({
        role_id: r.roleId,
        emoji: r.emoji,
        label: r.label,
        style: r.style,
      })),
    });
  }

  async deleteReactionRoles(
    guildId: string,
    messageId: string,
  ): Promise<void> {
    await this.delete(`/api/v1/guilds/${guildId}/reaction-roles/${messageId}`);
  }

  // ─── Auto Roles ────────────────────────────────────────────────────

  async getAutoRoles(guildId: string): Promise<AutoRole[]> {
    return this.get(`/api/v1/guilds/${guildId}/auto-roles`);
  }

  async createAutoRole(
    guildId: string,
    data: { roleId: string; type?: string; delay?: number },
  ): Promise<AutoRole> {
    return this.post(`/api/v1/guilds/${guildId}/auto-roles`, {
      role_id: data.roleId,
      role_type: data.type ?? "join",
      delay: data.delay ?? 0,
    });
  }

  async deleteAutoRole(guildId: string, autoRoleId: number): Promise<void> {
    await this.delete(`/api/v1/guilds/${guildId}/auto-roles/${autoRoleId}`);
  }

  // ─── Bot Config ────────────────────────────────────────────────────

  async getBotConfig(): Promise<BotConfig> {
    return this.get("/api/v1/bot/config");
  }

  async updateBotConfig(
    updates: Partial<BotConfig>,
  ): Promise<BotConfig> {
    return this.put("/api/v1/bot/config", updates);
  }

  // ─── Embed Templates ──────────────────────────────────────────────

  async getEmbedTemplates(guildId: string): Promise<EmbedTemplate[]> {
    return this.get(`/api/v1/guilds/${guildId}/embed-templates`);
  }

  async createEmbedTemplate(
    guildId: string,
    data: { name: string; embed: unknown },
  ): Promise<EmbedTemplate> {
    return this.post(`/api/v1/guilds/${guildId}/embed-templates`, data);
  }

  async deleteEmbedTemplate(
    guildId: string,
    templateId: number,
  ): Promise<void> {
    await this.delete(`/api/v1/guilds/${guildId}/embed-templates/${templateId}`);
  }

  // ─── Reminders ────────────────────────────────────────────────────

  async createReminder(data: {
    userId: string;
    guildId: string;
    channelId: string;
    message: string;
    remindAt: string;
  }): Promise<Reminder> {
    return this.post("/api/v1/bot/reminders", {
      user_id: data.userId,
      guild_id: data.guildId,
      channel_id: data.channelId,
      message: data.message,
      remind_at: data.remindAt,
    });
  }

  async getReminders(userId: string): Promise<Reminder[]> {
    return this.get(`/api/v1/bot/reminders/${userId}`);
  }

  async deleteReminder(reminderId: number): Promise<void> {
    await this.delete(`/api/v1/bot/reminders/${reminderId}`);
  }
}
