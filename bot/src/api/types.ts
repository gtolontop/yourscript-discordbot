// Response types matching the Rust backend models

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

export interface User {
  id: string;
  xp: number;
  level: number;
  balance: number;
  last_daily: string | null;
  visible_xp: number;
  created_at: string;
  updated_at: string;
}

export interface Warn {
  id: number;
  target_user_id: string;
  moderator_id: string;
  reason: string;
  guild_id: string;
  created_at: string;
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
  review: string | null;
  review_rating: number | null;
  last_activity: string;
  created_at: string;
}

export interface TicketCategory {
  id: number;
  guild_id: string;
  name: string;
  emoji: string | null;
  description: string | null;
  created_at: string;
}

export interface TicketBlacklist {
  id: number;
  guild_id: string;
  user_id: string;
  reason: string | null;
  added_by: string;
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

export interface Suggestion {
  id: number;
  guild_id: string;
  user_id: string;
  message_id: string;
  content: string;
  status: string;
  staff_id: string | null;
  staff_reason: string | null;
  upvotes: number;
  downvotes: number;
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

export interface EmbedTemplate {
  id: number;
  guild_id: string;
  name: string;
  embed: string;
  created_at: string;
}

export interface Reminder {
  id: number;
  user_id: string;
  guild_id: string;
  channel_id: string;
  message: string;
  remind_at: string;
  created_at: string;
}

export interface BotConfig {
  id: string;
  status_type: string | null;
  status_text: string | null;
  status_url: string | null;
  updated_at: string;
}

export interface Transcript {
  id: string;
  ticket_id: number;
  ticket_number: number;
  guild_id: string;
  guild_name: string;
  user_id: string;
  user_name: string;
  closed_by: string;
  closed_by_name: string;
  subject: string | null;
  category: string | null;
  message_count: number;
  html: string;
  created_at: string;
}

export interface AddXpResult {
  user_id: string;
  xp: number;
  level: number;
  leveled_up: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
