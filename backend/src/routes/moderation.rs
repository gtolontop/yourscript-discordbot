use axum::{
    extract::{Path, State},
    routing::{delete, get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;

use crate::auth::middleware::AuthUser;
use crate::error::AppResult;
use crate::models::{CreateWarn, Warn};
use crate::services::moderation;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/{id}/warns", get(list_warns).post(create_warn))
        .route("/{id}/warns/{wid}", delete(delete_warn))
        .route(
            "/{id}/warns/user/{uid}",
            get(list_user_warns).delete(clear_user_warns),
        )
}

// ── GET /guilds/:id/warns ───────────────────────────────────────────────────

/// List all warns for a guild.
async fn list_warns(
    State(state): State<AppState>,
    _user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<Vec<Warn>>> {
    let warns = sqlx::query_as::<_, Warn>(
        "SELECT id, target_user_id, moderator_id, reason, guild_id, created_at \
         FROM warns WHERE guild_id = ? ORDER BY created_at DESC",
    )
    .bind(&id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(warns))
}

// ── GET /guilds/:id/warns/user/:uid ─────────────────────────────────────────

/// List all warns for a specific user in a guild.
async fn list_user_warns(
    State(state): State<AppState>,
    _user: AuthUser,
    Path((id, uid)): Path<(String, String)>,
) -> AppResult<Json<Vec<Warn>>> {
    let warns = moderation::get_warns(&state.db, &id, &uid).await?;
    Ok(Json(warns))
}

// ── POST /guilds/:id/warns ──────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateWarnBody {
    pub target_user_id: String,
    pub reason: String,
}

/// Create a new warn. The moderator is the authenticated user.
async fn create_warn(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<CreateWarnBody>,
) -> AppResult<Json<Warn>> {
    let warn = moderation::add_warn(
        &state.db,
        CreateWarn {
            target_user_id: body.target_user_id,
            moderator_id: user.id,
            reason: body.reason,
            guild_id: id,
        },
    )
    .await?;

    Ok(Json(warn))
}

// ── DELETE /guilds/:id/warns/:wid ───────────────────────────────────────────

/// Delete a specific warn by ID.
async fn delete_warn(
    State(state): State<AppState>,
    _user: AuthUser,
    Path((id, wid)): Path<(String, i64)>,
) -> AppResult<Json<serde_json::Value>> {
    moderation::delete_warn(&state.db, &id, wid).await?;
    Ok(Json(json!({ "deleted": true, "id": wid })))
}

// ── DELETE /guilds/:id/warns/user/:uid ──────────────────────────────────────

/// Clear all warns for a user in a guild.
async fn clear_user_warns(
    State(state): State<AppState>,
    _user: AuthUser,
    Path((id, uid)): Path<(String, String)>,
) -> AppResult<Json<serde_json::Value>> {
    let count = moderation::clear_warns(&state.db, &id, &uid).await?;
    Ok(Json(json!({ "cleared": count })))
}
