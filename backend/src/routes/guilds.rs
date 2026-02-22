use axum::{
    extract::{Path, State},
    routing::{get, put},
    Json, Router,
};
use serde_json::json;

use crate::auth::discord_oauth::{self, has_guild_access};
use crate::auth::middleware::AuthUser;
use crate::error::{AppError, AppResult};
use crate::models::GuildConfig;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_guilds))
        .route("/{id}/stats", get(guild_stats))
        .route("/{id}/channels", get(guild_channels))
        .route("/{id}/roles", get(guild_roles))
        .route("/{id}/config", get(get_config).put(update_config))
}

// ── GET / ───────────────────────────────────────────────────────────────────

/// List guilds the authenticated user has access to.
/// Returns only guilds where the user has ADMINISTRATOR or MANAGE_GUILD,
/// and additionally checks which guilds the bot is present in.
async fn list_guilds(
    State(state): State<AppState>,
    user: AuthUser,
) -> AppResult<Json<serde_json::Value>> {
    // Fetch user's guilds from Discord
    let user_guilds = discord_oauth::get_user_guilds(&state.http, &user.access_token)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to fetch guilds: {e}")))?;

    // Get list of guild IDs the bot is configured for (guilds table)
    let bot_guild_ids: Vec<String> = sqlx::query_scalar("SELECT id FROM guilds")
        .fetch_all(&state.db)
        .await?;

    // Filter to guilds the user can manage
    let guilds: Vec<serde_json::Value> = user_guilds
        .into_iter()
        .filter(|g| {
            g.permissions
                .as_deref()
                .map(has_guild_access)
                .unwrap_or(false)
        })
        .map(|g| {
            let bot_in = bot_guild_ids.contains(&g.id);
            json!({
                "id": g.id,
                "name": g.name,
                "icon": g.icon,
                "bot_in_guild": bot_in,
            })
        })
        .collect();

    Ok(Json(json!({ "guilds": guilds })))
}

// ── GET /:id/stats ──────────────────────────────────────────────────────────

/// Return aggregate statistics for a guild.
async fn guild_stats(
    State(state): State<AppState>,
    _user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    let open_tickets: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM tickets WHERE guild_id = ? AND status = 'open'",
    )
    .bind(&id)
    .fetch_one(&state.db)
    .await?;

    let total_tickets: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM tickets WHERE guild_id = ?")
            .bind(&id)
            .fetch_one(&state.db)
            .await?;

    let total_warns: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM warns WHERE guild_id = ?")
            .bind(&id)
            .fetch_one(&state.db)
            .await?;

    let active_giveaways: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM giveaways WHERE guild_id = ? AND ended = 0",
    )
    .bind(&id)
    .fetch_one(&state.db)
    .await?;

    let total_suggestions: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM suggestions WHERE guild_id = ?")
            .bind(&id)
            .fetch_one(&state.db)
            .await?;

    Ok(Json(json!({
        "guild_id": id,
        "open_tickets": open_tickets.0,
        "total_tickets": total_tickets.0,
        "total_warns": total_warns.0,
        "active_giveaways": active_giveaways.0,
        "total_suggestions": total_suggestions.0,
    })))
}

// ── GET /:id/channels ───────────────────────────────────────────────────────

/// Placeholder: channel list requires the Discord bot.
/// Returns empty array until bot provides this data.
async fn guild_channels(
    _user: AuthUser,
    Path(_id): Path<String>,
) -> Json<serde_json::Value> {
    Json(json!({ "channels": [] }))
}

// ── GET /:id/roles ──────────────────────────────────────────────────────────

/// Placeholder: role list requires the Discord bot.
/// Returns empty array until bot provides this data.
async fn guild_roles(
    _user: AuthUser,
    Path(_id): Path<String>,
) -> Json<serde_json::Value> {
    Json(json!({ "roles": [] }))
}

// ── GET /:id/config ─────────────────────────────────────────────────────────

/// Get the guild configuration. Upserts a default row if one does not exist.
async fn get_config(
    State(state): State<AppState>,
    _user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<GuildConfig>> {
    // Upsert: insert default if missing
    sqlx::query("INSERT OR IGNORE INTO guilds (id) VALUES (?)")
        .bind(&id)
        .execute(&state.db)
        .await?;

    let config = sqlx::query_as::<_, GuildConfig>("SELECT * FROM guilds WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.db)
        .await?;

    Ok(Json(config))
}

// ── PUT /:id/config ─────────────────────────────────────────────────────────

/// Update the guild configuration with a partial JSON body.
/// Accepts a raw JSON object so we can dynamically update only the fields provided.
async fn update_config(
    State(state): State<AppState>,
    _user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<serde_json::Value>,
) -> AppResult<Json<GuildConfig>> {
    // Ensure the guild row exists
    sqlx::query("INSERT OR IGNORE INTO guilds (id) VALUES (?)")
        .bind(&id)
        .execute(&state.db)
        .await?;

    let fields = body
        .as_object()
        .ok_or_else(|| AppError::BadRequest("Body must be a JSON object".to_string()))?;

    if fields.is_empty() {
        let config = sqlx::query_as::<_, GuildConfig>("SELECT * FROM guilds WHERE id = ?")
            .bind(&id)
            .fetch_one(&state.db)
            .await?;
        return Ok(Json(config));
    }

    update_guild_fields(&state.db, &id, fields).await?;

    // Return the updated config
    let config = sqlx::query_as::<_, GuildConfig>("SELECT * FROM guilds WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.db)
        .await?;

    Ok(Json(config))
}

/// Update guild config fields one-by-one from a JSON map.
async fn update_guild_fields(
    db: &sqlx::SqlitePool,
    guild_id: &str,
    fields: &serde_json::Map<String, serde_json::Value>,
) -> AppResult<()> {
    // Allowlisted column names to prevent SQL injection
    const ALLOWED_COLUMNS: &[&str] = &[
        "log_category_id", "all_logs_channel", "mod_logs_channel", "msg_logs_channel",
        "voice_logs_channel", "member_logs_channel", "server_logs_channel", "dashboard_logs_channel",
        "ticket_category_id", "ticket_transcript_channel", "ticket_review_channel",
        "ticket_public_review_channel", "ticket_counter", "ticket_support_role",
        "ticket_modal_label", "ticket_modal_placeholder", "ticket_modal_required",
        "level_up_channel", "level_up_message", "xp_cooldown", "xp_min", "xp_max",
        "welcome_channel", "welcome_message", "leave_channel", "leave_message",
        "suggestion_channel", "suggestion_approved_channel",
        "starboard_channel", "starboard_threshold",
        "automod_spam_enabled", "automod_spam_threshold", "automod_spam_interval",
        "automod_links_enabled", "automod_links_whitelist",
        "automod_caps_enabled", "automod_caps_threshold",
        "automod_wordfilter_enabled", "automod_wordfilter_words",
        "music_always_on", "music_always_on_channel",
        "ai_enabled", "ai_channels", "ai_trigger_mode", "ai_personality", "ai_model",
    ];

    for (key, value) in fields {
        if !ALLOWED_COLUMNS.contains(&key.as_str()) {
            continue;
        }

        let sql = format!("UPDATE guilds SET {key} = ?, updated_at = datetime('now') WHERE id = ?");

        match value {
            serde_json::Value::Null => {
                sqlx::query(&sql)
                    .bind(None::<String>)
                    .bind(guild_id)
                    .execute(db)
                    .await?;
            }
            serde_json::Value::Number(n) => {
                if let Some(i) = n.as_i64() {
                    sqlx::query(&sql).bind(i).bind(guild_id).execute(db).await?;
                } else if let Some(f) = n.as_f64() {
                    sqlx::query(&sql).bind(f as i64).bind(guild_id).execute(db).await?;
                }
            }
            serde_json::Value::String(s) => {
                sqlx::query(&sql).bind(s).bind(guild_id).execute(db).await?;
            }
            serde_json::Value::Bool(b) => {
                sqlx::query(&sql)
                    .bind(if *b { 1i64 } else { 0i64 })
                    .bind(guild_id)
                    .execute(db)
                    .await?;
            }
            _ => {
                // For arrays/objects, store as JSON string
                let json_str = serde_json::to_string(value)
                    .map_err(|e| AppError::Internal(anyhow::anyhow!("JSON serialize: {e}")))?;
                sqlx::query(&sql)
                    .bind(&json_str)
                    .bind(guild_id)
                    .execute(db)
                    .await?;
            }
        }
    }

    Ok(())
}
