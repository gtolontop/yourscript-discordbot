// ── Ticket ───────────────────────────────────────────────────────────────────

/// Row from the `tickets` table.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct Ticket {
    pub id: i64,
    pub number: i64,
    pub channel_id: String,
    pub user_id: String,
    pub guild_id: String,
    pub category: Option<String>,
    pub subject: Option<String>,
    /// "open", "closed", or "review".
    pub status: String,
    /// "low", "normal", "high", or "urgent".
    pub priority: String,
    pub claimed_by: Option<String>,
    pub closed_by: Option<String>,
    pub closed_at: Option<String>,
    pub review: Option<String>,
    pub review_rating: Option<i64>,
    pub last_activity: String,
    pub created_at: String,
}

/// Payload for creating a new ticket.
#[derive(Debug, serde::Deserialize)]
pub struct CreateTicket {
    pub number: i64,
    pub channel_id: String,
    pub user_id: String,
    pub guild_id: String,
    pub category: Option<String>,
    pub subject: Option<String>,
}

/// Partial-update payload for a ticket.
#[derive(Debug, serde::Deserialize)]
pub struct UpdateTicket {
    pub status: Option<String>,
    pub priority: Option<String>,
    pub claimed_by: Option<Option<String>>,
    pub closed_by: Option<Option<String>>,
    pub closed_at: Option<Option<String>>,
    pub review: Option<Option<String>>,
    pub review_rating: Option<Option<i64>>,
    pub last_activity: Option<String>,
}

// ── Ticket Category ─────────────────────────────────────────────────────────

/// Row from the `ticket_categories` table.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct TicketCategory {
    pub id: i64,
    pub guild_id: String,
    pub name: String,
    pub emoji: Option<String>,
    pub description: Option<String>,
    pub created_at: String,
}

/// Payload for creating a new ticket category.
#[derive(Debug, serde::Deserialize)]
pub struct CreateTicketCategory {
    pub guild_id: String,
    pub name: String,
    pub emoji: Option<String>,
    pub description: Option<String>,
}

// ── Ticket Blacklist ────────────────────────────────────────────────────────

/// Row from the `ticket_blacklists` table.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct TicketBlacklist {
    pub id: i64,
    pub guild_id: String,
    pub user_id: String,
    pub reason: Option<String>,
    pub added_by: String,
    pub created_at: String,
}

/// Payload for blacklisting a user from opening tickets.
#[derive(Debug, serde::Deserialize)]
pub struct CreateTicketBlacklist {
    pub guild_id: String,
    pub user_id: String,
    pub reason: Option<String>,
    pub added_by: String,
}
