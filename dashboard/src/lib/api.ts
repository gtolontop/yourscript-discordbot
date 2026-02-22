export interface User {
  id: string;
  username: string;
  avatar: string | null;
}

export interface Guild {
  id: string;
  name: string;
  icon: string | null;
  permissions: string;
}

export interface GuildConfig {
  id: string;
  log_category_id: string | null;
  all_logs_channel: string | null;
  mod_logs_channel: string | null;
  msg_logs_channel: string | null;
  voice_logs_channel: string | null;
  member_logs_channel: string | null;
  server_logs_channel: string | null;
  dashboard_logs_channel: string | null;
  ticket_category_id: string | null;
  ticket_transcript_channel: string | null;
  ticket_review_channel: string | null;
  ticket_public_review_channel: string | null;
  ticket_counter: number;
  ticket_support_role: string | null;
  ticket_modal_label: string;
  ticket_modal_placeholder: string;
  ticket_modal_required: number;
  level_up_channel: string | null;
  level_up_message: string;
  xp_cooldown: number;
  xp_min: number;
  xp_max: number;
  welcome_channel: string | null;
  welcome_message: string | null;
  leave_channel: string | null;
  leave_message: string | null;
  suggestion_channel: string | null;
  suggestion_approved_channel: string | null;
  starboard_channel: string | null;
  starboard_threshold: number;
  automod_spam_enabled: number;
  automod_spam_threshold: number;
  automod_spam_interval: number;
  automod_links_enabled: number;
  automod_links_whitelist: string | null;
  automod_caps_enabled: number;
  automod_caps_threshold: number;
  automod_wordfilter_enabled: number;
  automod_wordfilter_words: string | null;
  music_always_on: number;
  music_always_on_channel: string | null;
  ai_enabled: number;
  ai_channels: string | null;
  ai_trigger_mode: string;
  ai_personality: string | null;
  ai_model: string;
  created_at: string;
  updated_at: string;
}

export interface Ticket {
  id: number;
  number: number;
  channel_id: string;
  user_id: string;
  guild_id: string;
  category: string | null;
  subject: string | null;
  status: string;
  priority: string;
  claimed_by: string | null;
  closed_by: string | null;
  closed_at: string | null;
  created_at: string;
}

export interface Warn {
  id: number;
  target_user_id: string;
  moderator_id: string;
  reason: string;
  guild_id: string;
  created_at: string;
}

export interface Giveaway {
  id: number;
  guild_id: string;
  channel_id: string;
  message_id: string;
  host_id: string;
  prize: string;
  winners: number;
  required_role: string | null;
  ends_at: string;
  ended: number;
  winner_ids: string;
  participants: string;
  created_at: string;
}

export interface ReactionRole {
  id: number;
  guild_id: string;
  channel_id: string;
  message_id: string;
  role_id: string;
  emoji: string;
  label: string | null;
  style: string;
  created_at: string;
}

export interface AutoRole {
  id: number;
  guild_id: string;
  role_id: string;
  role_type: string;
  delay: number;
  created_at: string;
}

export interface LeaderboardEntry {
  user_id: string;
  xp: number;
  level: number;
  username?: string;
  avatar?: string;
}

export interface DashboardLog {
  id: number;
  guild_id: string;
  action: string;
  user_id: string;
  details: string | null;
  created_at: string;
}

export interface GuildStats {
  member_count: number;
  online_count: number;
  ticket_count: number;
  warn_count: number;
  active_giveaways: number;
  suggestion_count: number;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  position: number;
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
}

class ApiClient {
  private baseUrl = "/api/v1";

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include",
    });

    if (response.status === 401) {
      window.location.href = "/api/v1/auth/login";
      throw new Error("Unauthorized");
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API error ${response.status}: ${text}`);
    }

    return response.json() as Promise<T>;
  }

  // Auth
  async getMe(): Promise<User> {
    return this.request("GET", "/auth/me");
  }

  // Guilds
  async getGuilds(): Promise<Guild[]> {
    return this.request("GET", "/guilds");
  }

  async getGuildStats(guildId: string): Promise<GuildStats> {
    return this.request("GET", `/guilds/${guildId}/stats`);
  }

  async getGuildChannels(guildId: string): Promise<DiscordChannel[]> {
    return this.request("GET", `/guilds/${guildId}/channels`);
  }

  async getGuildRoles(guildId: string): Promise<DiscordRole[]> {
    return this.request("GET", `/guilds/${guildId}/roles`);
  }

  // Config
  async getGuildConfig(guildId: string): Promise<GuildConfig> {
    return this.request("GET", `/guilds/${guildId}/config`);
  }

  async updateGuildConfig(
    guildId: string,
    updates: Partial<GuildConfig>
  ): Promise<GuildConfig> {
    return this.request("PUT", `/guilds/${guildId}/config`, updates);
  }

  // Tickets
  async getTickets(
    guildId: string,
    page = 1,
    status?: string
  ): Promise<{ tickets: Ticket[]; total: number }> {
    const params = new URLSearchParams({ page: page.toString() });
    if (status) params.set("status", status);
    return this.request("GET", `/guilds/${guildId}/tickets?${params}`);
  }

  // Warns
  async getWarns(guildId: string, userId?: string): Promise<Warn[]> {
    if (userId) {
      return this.request("GET", `/guilds/${guildId}/warns/user/${userId}`);
    }
    return this.request("GET", `/guilds/${guildId}/warns`);
  }

  async deleteWarn(guildId: string, warnId: number): Promise<void> {
    await this.request("DELETE", `/guilds/${guildId}/warns/${warnId}`);
  }

  // Giveaways
  async getGiveaways(guildId: string): Promise<Giveaway[]> {
    return this.request("GET", `/guilds/${guildId}/giveaways`);
  }

  // Reaction Roles
  async getReactionRoles(guildId: string): Promise<ReactionRole[]> {
    return this.request("GET", `/guilds/${guildId}/reaction-roles`);
  }

  // Auto Roles
  async getAutoRoles(guildId: string): Promise<AutoRole[]> {
    return this.request("GET", `/guilds/${guildId}/auto-roles`);
  }

  async createAutoRole(
    guildId: string,
    data: { role_id: string; role_type?: string; delay?: number }
  ): Promise<AutoRole> {
    return this.request("POST", `/guilds/${guildId}/auto-roles`, data);
  }

  async deleteAutoRole(guildId: string, id: number): Promise<void> {
    await this.request("DELETE", `/guilds/${guildId}/auto-roles/${id}`);
  }

  // Leaderboard
  async getLeaderboard(
    guildId: string,
    page = 1
  ): Promise<{ items: LeaderboardEntry[]; total: number }> {
    return this.request(
      "GET",
      `/guilds/${guildId}/leaderboard?page=${page}&limit=20`
    );
  }

  // Logs
  async getLogs(
    guildId: string,
    page = 1
  ): Promise<{ logs: DashboardLog[]; total: number }> {
    return this.request("GET", `/guilds/${guildId}/logs?page=${page}`);
  }
}

export const api = new ApiClient();
