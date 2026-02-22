-- Core: guilds (all config in one table)
CREATE TABLE IF NOT EXISTS guilds (
    id TEXT PRIMARY KEY NOT NULL, -- Discord guild ID

    -- Log channels
    log_category_id TEXT,
    all_logs_channel TEXT,
    mod_logs_channel TEXT,
    msg_logs_channel TEXT,
    voice_logs_channel TEXT,
    member_logs_channel TEXT,
    server_logs_channel TEXT,
    dashboard_logs_channel TEXT,

    -- Ticket system
    ticket_category_id TEXT,
    ticket_transcript_channel TEXT,
    ticket_review_channel TEXT,
    ticket_public_review_channel TEXT,
    ticket_counter INTEGER NOT NULL DEFAULT 0,
    ticket_support_role TEXT,
    ticket_modal_label TEXT NOT NULL DEFAULT 'Subject (optional)',
    ticket_modal_placeholder TEXT NOT NULL DEFAULT 'Briefly describe your issue...',
    ticket_modal_required INTEGER NOT NULL DEFAULT 0,

    -- XP / Leveling
    level_up_channel TEXT,
    level_up_message TEXT NOT NULL DEFAULT 'GG {user}, you are now level **{level}**!',
    xp_cooldown INTEGER NOT NULL DEFAULT 60,
    xp_min INTEGER NOT NULL DEFAULT 15,
    xp_max INTEGER NOT NULL DEFAULT 25,

    -- Welcome / Leave
    welcome_channel TEXT,
    welcome_message TEXT,
    leave_channel TEXT,
    leave_message TEXT,

    -- Suggestions
    suggestion_channel TEXT,
    suggestion_approved_channel TEXT,

    -- Starboard
    starboard_channel TEXT,
    starboard_threshold INTEGER NOT NULL DEFAULT 3,

    -- Automod
    automod_spam_enabled INTEGER NOT NULL DEFAULT 0,
    automod_spam_threshold INTEGER NOT NULL DEFAULT 5,
    automod_spam_interval INTEGER NOT NULL DEFAULT 5,
    automod_links_enabled INTEGER NOT NULL DEFAULT 0,
    automod_links_whitelist TEXT, -- JSON array of allowed domains
    automod_caps_enabled INTEGER NOT NULL DEFAULT 0,
    automod_caps_threshold INTEGER NOT NULL DEFAULT 70,
    automod_wordfilter_enabled INTEGER NOT NULL DEFAULT 0,
    automod_wordfilter_words TEXT, -- JSON array of blocked words

    -- Music 24/7
    music_always_on INTEGER NOT NULL DEFAULT 0,
    music_always_on_channel TEXT,

    -- AI selfbot config
    ai_enabled INTEGER NOT NULL DEFAULT 0,
    ai_channels TEXT, -- JSON array of channel IDs
    ai_trigger_mode TEXT NOT NULL DEFAULT 'mention', -- mention, always, keyword, ticket
    ai_personality TEXT,
    ai_model TEXT NOT NULL DEFAULT 'gpt-4o-mini',

    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Core: users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL, -- Discord user ID
    xp INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 0,
    balance INTEGER NOT NULL DEFAULT 100,
    last_daily TEXT, -- ISO timestamp
    visible_xp INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Moderation: warns
CREATE TABLE IF NOT EXISTS warns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_user_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_warns_guild ON warns(guild_id);
CREATE INDEX IF NOT EXISTS idx_warns_target ON warns(target_user_id, guild_id);

-- Moderation: temp_punishments
CREATE TABLE IF NOT EXISTS temp_punishments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    punishment_type TEXT NOT NULL, -- 'ban' or 'mute'
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_temp_punishments_expires ON temp_punishments(expires_at);

-- Tickets
CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number INTEGER NOT NULL,
    channel_id TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    category TEXT,
    subject TEXT,
    status TEXT NOT NULL DEFAULT 'open', -- open, closed, review
    priority TEXT NOT NULL DEFAULT 'normal', -- low, normal, high, urgent
    claimed_by TEXT,
    closed_by TEXT,
    closed_at TEXT,
    review TEXT,
    review_rating INTEGER,
    last_activity TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_tickets_guild ON tickets(guild_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(guild_id, status);

-- Ticket categories
CREATE TABLE IF NOT EXISTS ticket_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    emoji TEXT,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(guild_id, name)
);

-- Ticket blacklist
CREATE TABLE IF NOT EXISTS ticket_blacklists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    reason TEXT,
    added_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(guild_id, user_id)
);

-- Transcripts
CREATE TABLE IF NOT EXISTS transcripts (
    id TEXT PRIMARY KEY NOT NULL, -- UUID
    ticket_id INTEGER NOT NULL,
    ticket_number INTEGER NOT NULL,
    guild_id TEXT NOT NULL,
    guild_name TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    closed_by TEXT NOT NULL,
    closed_by_name TEXT NOT NULL,
    subject TEXT,
    category TEXT,
    message_count INTEGER NOT NULL,
    html TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Suggestions
CREATE TABLE IF NOT EXISTS suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    message_id TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    staff_id TEXT,
    staff_reason TEXT,
    upvotes INTEGER NOT NULL DEFAULT 0,
    downvotes INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Giveaways
CREATE TABLE IF NOT EXISTS giveaways (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT UNIQUE NOT NULL,
    host_id TEXT NOT NULL,
    prize TEXT NOT NULL,
    winners INTEGER NOT NULL DEFAULT 1,
    required_role TEXT,
    ends_at TEXT NOT NULL,
    ended INTEGER NOT NULL DEFAULT 0,
    winner_ids TEXT NOT NULL DEFAULT '[]', -- JSON array
    participants TEXT NOT NULL DEFAULT '[]', -- JSON array
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_giveaways_guild ON giveaways(guild_id);

-- Reaction roles
CREATE TABLE IF NOT EXISTS reaction_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    emoji TEXT NOT NULL,
    label TEXT,
    style TEXT NOT NULL DEFAULT 'primary',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(message_id, role_id)
);

-- Auto roles
CREATE TABLE IF NOT EXISTS auto_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    role_type TEXT NOT NULL DEFAULT 'join', -- join, bot
    delay INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(guild_id, role_id)
);

-- Embed templates
CREATE TABLE IF NOT EXISTS embed_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    embed TEXT NOT NULL, -- JSON
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(guild_id, name)
);

-- Reminders
CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message TEXT NOT NULL,
    remind_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reminders_time ON reminders(remind_at);

-- Dashboard logs
CREATE TABLE IF NOT EXISTS dashboard_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_dashboard_logs_guild ON dashboard_logs(guild_id, created_at);

-- Sessions (for OAuth2)
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    username TEXT NOT NULL,
    avatar TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Bot config (singleton)
CREATE TABLE IF NOT EXISTS bot_config (
    id TEXT PRIMARY KEY NOT NULL DEFAULT 'bot',
    status_type TEXT,
    status_text TEXT,
    status_url TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert default bot config
INSERT OR IGNORE INTO bot_config (id) VALUES ('bot');
