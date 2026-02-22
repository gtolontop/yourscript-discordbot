/// Full guild configuration row from the `guilds` table.
/// All config for a Discord server lives in this single table.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct GuildConfig {
    /// Discord guild (server) ID.
    pub id: String,

    // ── Log channels ────────────────────────────────────────────────
    pub log_category_id: Option<String>,
    pub all_logs_channel: Option<String>,
    pub mod_logs_channel: Option<String>,
    pub msg_logs_channel: Option<String>,
    pub voice_logs_channel: Option<String>,
    pub member_logs_channel: Option<String>,
    pub server_logs_channel: Option<String>,
    pub dashboard_logs_channel: Option<String>,

    // ── Ticket system ───────────────────────────────────────────────
    pub ticket_category_id: Option<String>,
    pub ticket_transcript_channel: Option<String>,
    pub ticket_review_channel: Option<String>,
    pub ticket_public_review_channel: Option<String>,
    pub ticket_counter: i64,
    pub ticket_support_role: Option<String>,
    pub ticket_modal_label: String,
    pub ticket_modal_placeholder: String,
    /// Stored as INTEGER 0/1 in SQLite.
    pub ticket_modal_required: i64,

    // ── XP / Leveling ───────────────────────────────────────────────
    pub level_up_channel: Option<String>,
    pub level_up_message: String,
    pub xp_cooldown: i64,
    pub xp_min: i64,
    pub xp_max: i64,

    // ── Welcome / Leave ─────────────────────────────────────────────
    pub welcome_channel: Option<String>,
    pub welcome_message: Option<String>,
    pub leave_channel: Option<String>,
    pub leave_message: Option<String>,

    // ── Suggestions ─────────────────────────────────────────────────
    pub suggestion_channel: Option<String>,
    pub suggestion_approved_channel: Option<String>,

    // ── Starboard ───────────────────────────────────────────────────
    pub starboard_channel: Option<String>,
    pub starboard_threshold: i64,

    // ── Automod ─────────────────────────────────────────────────────
    /// 0 = disabled, 1 = enabled.
    pub automod_spam_enabled: i64,
    pub automod_spam_threshold: i64,
    pub automod_spam_interval: i64,
    /// 0 = disabled, 1 = enabled.
    pub automod_links_enabled: i64,
    /// JSON array of allowed domains.
    pub automod_links_whitelist: Option<String>,
    /// 0 = disabled, 1 = enabled.
    pub automod_caps_enabled: i64,
    pub automod_caps_threshold: i64,
    /// 0 = disabled, 1 = enabled.
    pub automod_wordfilter_enabled: i64,
    /// JSON array of blocked words.
    pub automod_wordfilter_words: Option<String>,

    // ── Music 24/7 ──────────────────────────────────────────────────
    /// 0 = disabled, 1 = enabled.
    pub music_always_on: i64,
    pub music_always_on_channel: Option<String>,

    // ── AI / Selfbot ────────────────────────────────────────────────
    /// 0 = disabled, 1 = enabled.
    pub ai_enabled: i64,
    /// JSON array of channel IDs.
    pub ai_channels: Option<String>,
    /// "mention", "always", "keyword", or "ticket".
    pub ai_trigger_mode: String,
    pub ai_personality: Option<String>,
    pub ai_model: String,

    // ── Timestamps ──────────────────────────────────────────────────
    pub created_at: String,
    pub updated_at: String,
}

/// Payload accepted when creating a new guild config.
/// Only the `id` is required; every other field falls back to the DB default.
#[derive(Debug, serde::Deserialize)]
pub struct CreateGuildConfig {
    pub id: String,
}

/// Partial-update payload. Every field is optional so the API
/// can accept sparse PATCH requests.
#[derive(Debug, serde::Deserialize)]
pub struct UpdateGuildConfig {
    // Log channels
    pub log_category_id: Option<Option<String>>,
    pub all_logs_channel: Option<Option<String>>,
    pub mod_logs_channel: Option<Option<String>>,
    pub msg_logs_channel: Option<Option<String>>,
    pub voice_logs_channel: Option<Option<String>>,
    pub member_logs_channel: Option<Option<String>>,
    pub server_logs_channel: Option<Option<String>>,
    pub dashboard_logs_channel: Option<Option<String>>,

    // Ticket system
    pub ticket_category_id: Option<Option<String>>,
    pub ticket_transcript_channel: Option<Option<String>>,
    pub ticket_review_channel: Option<Option<String>>,
    pub ticket_public_review_channel: Option<Option<String>>,
    pub ticket_counter: Option<i64>,
    pub ticket_support_role: Option<Option<String>>,
    pub ticket_modal_label: Option<String>,
    pub ticket_modal_placeholder: Option<String>,
    pub ticket_modal_required: Option<i64>,

    // XP / Leveling
    pub level_up_channel: Option<Option<String>>,
    pub level_up_message: Option<String>,
    pub xp_cooldown: Option<i64>,
    pub xp_min: Option<i64>,
    pub xp_max: Option<i64>,

    // Welcome / Leave
    pub welcome_channel: Option<Option<String>>,
    pub welcome_message: Option<Option<String>>,
    pub leave_channel: Option<Option<String>>,
    pub leave_message: Option<Option<String>>,

    // Suggestions
    pub suggestion_channel: Option<Option<String>>,
    pub suggestion_approved_channel: Option<Option<String>>,

    // Starboard
    pub starboard_channel: Option<Option<String>>,
    pub starboard_threshold: Option<i64>,

    // Automod
    pub automod_spam_enabled: Option<i64>,
    pub automod_spam_threshold: Option<i64>,
    pub automod_spam_interval: Option<i64>,
    pub automod_links_enabled: Option<i64>,
    pub automod_links_whitelist: Option<Option<String>>,
    pub automod_caps_enabled: Option<i64>,
    pub automod_caps_threshold: Option<i64>,
    pub automod_wordfilter_enabled: Option<i64>,
    pub automod_wordfilter_words: Option<Option<String>>,

    // Music 24/7
    pub music_always_on: Option<i64>,
    pub music_always_on_channel: Option<Option<String>>,

    // AI / Selfbot
    pub ai_enabled: Option<i64>,
    pub ai_channels: Option<Option<String>>,
    pub ai_trigger_mode: Option<String>,
    pub ai_personality: Option<Option<String>>,
    pub ai_model: Option<String>,
}
