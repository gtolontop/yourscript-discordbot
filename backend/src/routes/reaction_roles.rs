use axum::{
    extract::{Path, State},
    routing::{delete, get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;

use crate::auth::middleware::AuthUser;
use crate::error::{AppError, AppResult};
use crate::models::ReactionRole;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/{id}/reaction-roles",
            get(list_reaction_roles).post(create_reaction_roles),
        )
        .route("/{id}/reaction-roles/{mid}", delete(delete_reaction_roles))
}

// ── GET /guilds/:id/reaction-roles ──────────────────────────────────────────

async fn list_reaction_roles(
    State(state): State<AppState>,
    _user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<Vec<ReactionRole>>> {
    let roles = sqlx::query_as::<_, ReactionRole>(
        "SELECT * FROM reaction_roles WHERE guild_id = ? ORDER BY created_at DESC",
    )
    .bind(&id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(roles))
}

// ── POST /guilds/:id/reaction-roles ─────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateReactionRolesBody {
    pub channel_id: String,
    pub message_id: String,
    pub roles: Vec<RoleEntry>,
}

#[derive(Debug, Deserialize)]
pub struct RoleEntry {
    pub role_id: String,
    pub emoji: String,
    pub label: Option<String>,
    pub style: Option<String>,
}

async fn create_reaction_roles(
    State(state): State<AppState>,
    _user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<CreateReactionRolesBody>,
) -> AppResult<Json<Vec<ReactionRole>>> {
    let mut created = Vec::new();

    for role in &body.roles {
        let style = role.style.as_deref().unwrap_or("primary");

        sqlx::query(
            "INSERT OR REPLACE INTO reaction_roles (guild_id, channel_id, message_id, role_id, emoji, label, style) \
             VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&body.channel_id)
        .bind(&body.message_id)
        .bind(&role.role_id)
        .bind(&role.emoji)
        .bind(&role.label)
        .bind(style)
        .execute(&state.db)
        .await?;
    }

    // Fetch all reaction roles for this message
    created.extend(
        sqlx::query_as::<_, ReactionRole>(
            "SELECT * FROM reaction_roles WHERE guild_id = ? AND message_id = ?",
        )
        .bind(&id)
        .bind(&body.message_id)
        .fetch_all(&state.db)
        .await?,
    );

    Ok(Json(created))
}

// ── DELETE /guilds/:id/reaction-roles/:mid ──────────────────────────────────

/// Delete all reaction roles associated with a specific message ID.
async fn delete_reaction_roles(
    State(state): State<AppState>,
    _user: AuthUser,
    Path((id, mid)): Path<(String, String)>,
) -> AppResult<Json<serde_json::Value>> {
    let result = sqlx::query(
        "DELETE FROM reaction_roles WHERE guild_id = ? AND message_id = ?",
    )
    .bind(&id)
    .bind(&mid)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!(
            "No reaction roles found for message {mid}"
        )));
    }

    Ok(Json(json!({
        "deleted": true,
        "message_id": mid,
        "count": result.rows_affected(),
    })))
}
