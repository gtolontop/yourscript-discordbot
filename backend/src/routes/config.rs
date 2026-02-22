use axum::{
    extract::{Path, State},
    routing::post,
    Json, Router,
};
use serde_json::json;

use crate::auth::middleware::AuthUser;
use crate::error::AppResult;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/{id}/config/logs/setup", post(setup_log_channels))
}

// ── POST /guilds/:id/config/logs/setup ──────────────────────────────────────

/// Placeholder for automatic log channel creation.
/// This operation requires the Discord bot to create channels, so the backend
/// returns a stub response. The bot should be called via its API to perform
/// the actual channel creation, then update the guild config accordingly.
async fn setup_log_channels(
    State(_state): State<AppState>,
    _user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    // TODO: Call the bot's internal API to create log channels in the guild,
    // then update the guild config with the new channel IDs.
    Ok(Json(json!({
        "message": "Log channel auto-creation requires the bot. This is a placeholder.",
        "guild_id": id,
        "status": "not_implemented",
    })))
}
