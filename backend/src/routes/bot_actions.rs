use axum::{
    extract::{Path, State},
    routing::{get, post, put},
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;

use crate::auth::middleware::BotAuth;
use crate::error::{AppError, AppResult};
use crate::models::{BotConfig, CreateWarn, Ticket, UpdateBotConfig, Warn};
use crate::services::moderation;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        // Ticket creation from bot
        .route("/guilds/{id}/tickets", post(bot_create_ticket))
        // Warn creation from bot
        .route("/guilds/{id}/warns", post(bot_create_warn))
        // XP management
        .route("/xp", post(bot_add_xp))
        // Giveaway entry from bot
        .route("/giveaway-enter", post(bot_giveaway_enter))
        // Bot config (status etc.)
        .route("/config", get(bot_get_config).put(bot_update_config))
}

// ── POST /bot/guilds/:id/tickets ────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct BotCreateTicketBody {
    pub number: i64,
    pub channel_id: String,
    pub user_id: String,
    pub category: Option<String>,
    pub subject: Option<String>,
}

async fn bot_create_ticket(
    State(state): State<AppState>,
    _auth: BotAuth,
    Path(id): Path<String>,
    Json(body): Json<BotCreateTicketBody>,
) -> AppResult<Json<Ticket>> {
    sqlx::query(
        "INSERT INTO tickets (number, channel_id, user_id, guild_id, category, subject) \
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(body.number)
    .bind(&body.channel_id)
    .bind(&body.user_id)
    .bind(&id)
    .bind(&body.category)
    .bind(&body.subject)
    .execute(&state.db)
    .await?;

    let ticket = sqlx::query_as::<_, Ticket>(
        "SELECT * FROM tickets WHERE id = last_insert_rowid()",
    )
    .fetch_one(&state.db)
    .await?;

    // Broadcast via WebSocket
    let _ = state.ws_tx.send(crate::state::WsEvent::TicketUpdate {
        guild_id: id,
        ticket_id: ticket.id,
        status: "open".to_string(),
    });

    Ok(Json(ticket))
}

// ── POST /bot/guilds/:id/warns ──────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct BotCreateWarnBody {
    pub target_user_id: String,
    pub moderator_id: String,
    pub reason: String,
}

async fn bot_create_warn(
    State(state): State<AppState>,
    _auth: BotAuth,
    Path(id): Path<String>,
    Json(body): Json<BotCreateWarnBody>,
) -> AppResult<Json<Warn>> {
    let warn = moderation::add_warn(
        &state.db,
        CreateWarn {
            target_user_id: body.target_user_id,
            moderator_id: body.moderator_id,
            reason: body.reason,
            guild_id: id,
        },
    )
    .await?;

    Ok(Json(warn))
}

// ── POST /bot/xp ────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct BotAddXpBody {
    pub user_id: String,
    pub amount: i64,
}

async fn bot_add_xp(
    State(state): State<AppState>,
    _auth: BotAuth,
    Json(body): Json<BotAddXpBody>,
) -> AppResult<Json<serde_json::Value>> {
    // Upsert user: create if not exists, then add XP
    sqlx::query(
        "INSERT INTO users (id, xp) VALUES (?, ?) \
         ON CONFLICT(id) DO UPDATE SET xp = xp + excluded.xp, updated_at = datetime('now')",
    )
    .bind(&body.user_id)
    .bind(body.amount)
    .execute(&state.db)
    .await?;

    // Check for level up
    let user_row: (i64, i64) = sqlx::query_as(
        "SELECT xp, level FROM users WHERE id = ?",
    )
    .bind(&body.user_id)
    .fetch_one(&state.db)
    .await?;

    let (xp, current_level) = user_row;
    let new_level = calculate_level(xp);

    let leveled_up = if new_level > current_level {
        sqlx::query("UPDATE users SET level = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(new_level)
            .bind(&body.user_id)
            .execute(&state.db)
            .await?;
        true
    } else {
        false
    };

    Ok(Json(json!({
        "user_id": body.user_id,
        "xp": xp,
        "level": new_level,
        "leveled_up": leveled_up,
    })))
}

// ── POST /bot/giveaway-enter ────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct BotGiveawayEnterBody {
    pub giveaway_id: i64,
    pub user_id: String,
}

async fn bot_giveaway_enter(
    State(state): State<AppState>,
    _auth: BotAuth,
    Json(body): Json<BotGiveawayEnterBody>,
) -> AppResult<Json<serde_json::Value>> {
    let giveaway = sqlx::query_as::<_, crate::models::Giveaway>(
        "SELECT * FROM giveaways WHERE id = ?",
    )
    .bind(body.giveaway_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| {
        AppError::NotFound(format!("Giveaway {} not found", body.giveaway_id))
    })?;

    if giveaway.ended == 1 {
        return Err(AppError::BadRequest("Giveaway has already ended".to_string()));
    }

    let mut participants: Vec<String> =
        serde_json::from_str(&giveaway.participants).unwrap_or_default();

    if participants.contains(&body.user_id) {
        return Ok(Json(json!({
            "entered": false,
            "reason": "already_entered",
        })));
    }

    participants.push(body.user_id.clone());
    let participants_json = serde_json::to_string(&participants)
        .unwrap_or_else(|_| "[]".to_string());

    sqlx::query("UPDATE giveaways SET participants = ? WHERE id = ?")
        .bind(&participants_json)
        .bind(body.giveaway_id)
        .execute(&state.db)
        .await?;

    Ok(Json(json!({
        "entered": true,
        "user_id": body.user_id,
        "total_participants": participants.len(),
    })))
}

// ── GET /bot/config ─────────────────────────────────────────────────────────

async fn bot_get_config(
    State(state): State<AppState>,
    _auth: BotAuth,
) -> AppResult<Json<BotConfig>> {
    // Ensure the singleton row exists
    sqlx::query("INSERT OR IGNORE INTO bot_config (id) VALUES ('bot')")
        .execute(&state.db)
        .await?;

    let config = sqlx::query_as::<_, BotConfig>(
        "SELECT * FROM bot_config WHERE id = 'bot'",
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(config))
}

// ── PUT /bot/config ─────────────────────────────────────────────────────────

async fn bot_update_config(
    State(state): State<AppState>,
    _auth: BotAuth,
    Json(body): Json<UpdateBotConfig>,
) -> AppResult<Json<BotConfig>> {
    // Ensure the singleton row exists
    sqlx::query("INSERT OR IGNORE INTO bot_config (id) VALUES ('bot')")
        .execute(&state.db)
        .await?;

    // Update provided fields
    if let Some(ref status_type) = body.status_type {
        sqlx::query(
            "UPDATE bot_config SET status_type = ?, updated_at = datetime('now') WHERE id = 'bot'",
        )
        .bind(status_type.as_deref())
        .execute(&state.db)
        .await?;
    }

    if let Some(ref status_text) = body.status_text {
        sqlx::query(
            "UPDATE bot_config SET status_text = ?, updated_at = datetime('now') WHERE id = 'bot'",
        )
        .bind(status_text.as_deref())
        .execute(&state.db)
        .await?;
    }

    if let Some(ref status_url) = body.status_url {
        sqlx::query(
            "UPDATE bot_config SET status_url = ?, updated_at = datetime('now') WHERE id = 'bot'",
        )
        .bind(status_url.as_deref())
        .execute(&state.db)
        .await?;
    }

    let config = sqlx::query_as::<_, BotConfig>(
        "SELECT * FROM bot_config WHERE id = 'bot'",
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(config))
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/// Calculate the level from total XP using a simple formula.
/// Level N requires N * 100 XP (cumulative: level 1 = 100 XP, level 2 = 300 XP total, etc.)
fn calculate_level(xp: i64) -> i64 {
    // Inverse of cumulative XP formula: total = level * (level + 1) * 50
    // Solve for level: level = (-1 + sqrt(1 + 4 * total / 50)) / 2
    let discriminant = 1.0 + (xp as f64 * 4.0 / 50.0);
    if discriminant < 0.0 {
        return 0;
    }
    let level = (-1.0 + discriminant.sqrt()) / 2.0;
    level.floor() as i64
}
