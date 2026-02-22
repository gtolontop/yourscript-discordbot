use sqlx::SqlitePool;

use crate::error::{AppError, AppResult};
use crate::models::{Ticket, TicketBlacklist, TicketCategory};

// ── Ticket CRUD ──────────────────────────────────────────────────────────────

/// Create a new ticket.
///
/// Atomically increments the guild's `ticket_counter` and inserts a new ticket
/// row using the new counter value as the ticket number.
pub async fn create_ticket(
    pool: &SqlitePool,
    guild_id: &str,
    channel_id: &str,
    user_id: &str,
    category: Option<&str>,
    subject: Option<&str>,
) -> AppResult<Ticket> {
    // Increment the guild ticket counter and get the new value.
    sqlx::query("UPDATE guilds SET ticket_counter = ticket_counter + 1, updated_at = datetime('now') WHERE id = ?")
        .bind(guild_id)
        .execute(pool)
        .await?;

    let counter_row: (i64,) =
        sqlx::query_as("SELECT ticket_counter FROM guilds WHERE id = ?")
            .bind(guild_id)
            .fetch_one(pool)
            .await?;
    let number = counter_row.0;

    sqlx::query(
        "INSERT INTO tickets (number, channel_id, user_id, guild_id, category, subject) \
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(number)
    .bind(channel_id)
    .bind(user_id)
    .bind(guild_id)
    .bind(category)
    .bind(subject)
    .execute(pool)
    .await?;

    let ticket = sqlx::query_as::<_, Ticket>(
        "SELECT id, number, channel_id, user_id, guild_id, category, subject, \
         status, priority, claimed_by, closed_by, closed_at, review, review_rating, \
         last_activity, created_at \
         FROM tickets WHERE id = last_insert_rowid()",
    )
    .fetch_one(pool)
    .await?;

    Ok(ticket)
}

/// Close a ticket by setting its status to `closed`.
pub async fn close_ticket(
    pool: &SqlitePool,
    ticket_id: i64,
    closed_by: &str,
) -> AppResult<Ticket> {
    let result = sqlx::query(
        "UPDATE tickets SET status = 'closed', closed_by = ?, closed_at = datetime('now'), \
         last_activity = datetime('now') WHERE id = ?",
    )
    .bind(closed_by)
    .bind(ticket_id)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Ticket {ticket_id} not found")));
    }

    get_ticket(pool, ticket_id).await
}

/// Fetch a single ticket by ID.
pub async fn get_ticket(pool: &SqlitePool, ticket_id: i64) -> AppResult<Ticket> {
    let ticket = sqlx::query_as::<_, Ticket>(
        "SELECT id, number, channel_id, user_id, guild_id, category, subject, \
         status, priority, claimed_by, closed_by, closed_at, review, review_rating, \
         last_activity, created_at \
         FROM tickets WHERE id = ?",
    )
    .bind(ticket_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Ticket {ticket_id} not found")))?;

    Ok(ticket)
}

/// List tickets for a guild with optional status filter and pagination.
///
/// * `status` - If `Some`, only tickets with this status are returned.
/// * `limit`  - Maximum number of rows (default 50).
/// * `offset` - Number of rows to skip (default 0).
pub async fn list_tickets(
    pool: &SqlitePool,
    guild_id: &str,
    status: Option<&str>,
    limit: i64,
    offset: i64,
) -> AppResult<Vec<Ticket>> {
    let tickets = if let Some(s) = status {
        sqlx::query_as::<_, Ticket>(
            "SELECT id, number, channel_id, user_id, guild_id, category, subject, \
             status, priority, claimed_by, closed_by, closed_at, review, review_rating, \
             last_activity, created_at \
             FROM tickets WHERE guild_id = ? AND status = ? \
             ORDER BY created_at DESC LIMIT ? OFFSET ?",
        )
        .bind(guild_id)
        .bind(s)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as::<_, Ticket>(
            "SELECT id, number, channel_id, user_id, guild_id, category, subject, \
             status, priority, claimed_by, closed_by, closed_at, review, review_rating, \
             last_activity, created_at \
             FROM tickets WHERE guild_id = ? \
             ORDER BY created_at DESC LIMIT ? OFFSET ?",
        )
        .bind(guild_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?
    };

    Ok(tickets)
}

/// Update the priority of a ticket.
pub async fn update_priority(
    pool: &SqlitePool,
    ticket_id: i64,
    priority: &str,
) -> AppResult<Ticket> {
    let result = sqlx::query(
        "UPDATE tickets SET priority = ?, last_activity = datetime('now') WHERE id = ?",
    )
    .bind(priority)
    .bind(ticket_id)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Ticket {ticket_id} not found")));
    }

    get_ticket(pool, ticket_id).await
}

/// Claim a ticket (assign a staff member).
pub async fn claim_ticket(
    pool: &SqlitePool,
    ticket_id: i64,
    claimer_id: &str,
) -> AppResult<Ticket> {
    let result = sqlx::query(
        "UPDATE tickets SET claimed_by = ?, last_activity = datetime('now') WHERE id = ?",
    )
    .bind(claimer_id)
    .bind(ticket_id)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Ticket {ticket_id} not found")));
    }

    get_ticket(pool, ticket_id).await
}

// ── Ticket Categories ────────────────────────────────────────────────────────

/// List all ticket categories for a guild.
pub async fn get_categories(pool: &SqlitePool, guild_id: &str) -> AppResult<Vec<TicketCategory>> {
    let categories = sqlx::query_as::<_, TicketCategory>(
        "SELECT id, guild_id, name, emoji, description, created_at \
         FROM ticket_categories WHERE guild_id = ? ORDER BY name ASC",
    )
    .bind(guild_id)
    .fetch_all(pool)
    .await?;

    Ok(categories)
}

/// Add a new ticket category.
pub async fn add_category(
    pool: &SqlitePool,
    guild_id: &str,
    name: &str,
    emoji: Option<&str>,
    description: Option<&str>,
) -> AppResult<TicketCategory> {
    sqlx::query(
        "INSERT INTO ticket_categories (guild_id, name, emoji, description) VALUES (?, ?, ?, ?)",
    )
    .bind(guild_id)
    .bind(name)
    .bind(emoji)
    .bind(description)
    .execute(pool)
    .await?;

    let category = sqlx::query_as::<_, TicketCategory>(
        "SELECT id, guild_id, name, emoji, description, created_at \
         FROM ticket_categories WHERE id = last_insert_rowid()",
    )
    .fetch_one(pool)
    .await?;

    Ok(category)
}

/// Delete a ticket category by ID (scoped to a guild).
pub async fn delete_category(
    pool: &SqlitePool,
    guild_id: &str,
    category_id: i64,
) -> AppResult<()> {
    let result =
        sqlx::query("DELETE FROM ticket_categories WHERE id = ? AND guild_id = ?")
            .bind(category_id)
            .bind(guild_id)
            .execute(pool)
            .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!(
            "Category {category_id} not found"
        )));
    }

    Ok(())
}

// ── Ticket Blacklist ─────────────────────────────────────────────────────────

/// Check whether a user is blacklisted from tickets in a guild.
/// Returns `Some(entry)` if blacklisted, `None` otherwise.
pub async fn check_blacklist(
    pool: &SqlitePool,
    guild_id: &str,
    user_id: &str,
) -> AppResult<Option<TicketBlacklist>> {
    let entry = sqlx::query_as::<_, TicketBlacklist>(
        "SELECT id, guild_id, user_id, reason, added_by, created_at \
         FROM ticket_blacklists WHERE guild_id = ? AND user_id = ?",
    )
    .bind(guild_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    Ok(entry)
}

/// Add a user to the ticket blacklist.
pub async fn add_blacklist(
    pool: &SqlitePool,
    guild_id: &str,
    user_id: &str,
    reason: Option<&str>,
    added_by: &str,
) -> AppResult<TicketBlacklist> {
    sqlx::query(
        "INSERT INTO ticket_blacklists (guild_id, user_id, reason, added_by) \
         VALUES (?, ?, ?, ?)",
    )
    .bind(guild_id)
    .bind(user_id)
    .bind(reason)
    .bind(added_by)
    .execute(pool)
    .await?;

    let entry = sqlx::query_as::<_, TicketBlacklist>(
        "SELECT id, guild_id, user_id, reason, added_by, created_at \
         FROM ticket_blacklists WHERE id = last_insert_rowid()",
    )
    .fetch_one(pool)
    .await?;

    Ok(entry)
}

/// Remove a user from the ticket blacklist.
pub async fn remove_blacklist(
    pool: &SqlitePool,
    guild_id: &str,
    user_id: &str,
) -> AppResult<()> {
    let result =
        sqlx::query("DELETE FROM ticket_blacklists WHERE guild_id = ? AND user_id = ?")
            .bind(guild_id)
            .bind(user_id)
            .execute(pool)
            .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!(
            "User {user_id} is not blacklisted in guild {guild_id}"
        )));
    }

    Ok(())
}
