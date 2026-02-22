use axum::{
    extract::{Path, State},
    routing::{delete, get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;

use crate::auth::middleware::AuthUser;
use crate::error::{AppError, AppResult};
use crate::models::AutoRole;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/{id}/auto-roles",
            get(list_auto_roles).post(create_auto_role),
        )
        .route("/{id}/auto-roles/{arid}", delete(delete_auto_role))
}

// ── GET /guilds/:id/auto-roles ──────────────────────────────────────────────

async fn list_auto_roles(
    State(state): State<AppState>,
    _user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<Vec<AutoRole>>> {
    let roles = sqlx::query_as::<_, AutoRole>(
        "SELECT * FROM auto_roles WHERE guild_id = ? ORDER BY created_at DESC",
    )
    .bind(&id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(roles))
}

// ── POST /guilds/:id/auto-roles ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateAutoRoleBody {
    pub role_id: String,
    pub role_type: Option<String>,
    pub delay: Option<i64>,
}

async fn create_auto_role(
    State(state): State<AppState>,
    _user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<CreateAutoRoleBody>,
) -> AppResult<Json<AutoRole>> {
    let role_type = body.role_type.as_deref().unwrap_or("join");
    let delay = body.delay.unwrap_or(0);

    sqlx::query(
        "INSERT INTO auto_roles (guild_id, role_id, role_type, delay) VALUES (?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&body.role_id)
    .bind(role_type)
    .bind(delay)
    .execute(&state.db)
    .await
    .map_err(|e| match e {
        sqlx::Error::Database(ref db_err) if db_err.message().contains("UNIQUE") => {
            AppError::BadRequest(format!(
                "Auto role for role {} already exists in this guild",
                body.role_id
            ))
        }
        other => AppError::Database(other),
    })?;

    let auto_role = sqlx::query_as::<_, AutoRole>(
        "SELECT * FROM auto_roles WHERE id = last_insert_rowid()",
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(auto_role))
}

// ── DELETE /guilds/:id/auto-roles/:arid ─────────────────────────────────────

async fn delete_auto_role(
    State(state): State<AppState>,
    _user: AuthUser,
    Path((id, arid)): Path<(String, i64)>,
) -> AppResult<Json<serde_json::Value>> {
    let result = sqlx::query("DELETE FROM auto_roles WHERE guild_id = ? AND id = ?")
        .bind(&id)
        .bind(arid)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Auto role {arid} not found")));
    }

    Ok(Json(json!({ "deleted": true, "id": arid })))
}
