use axum::{
    extract::{Path, State},
    routing::{delete, get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;

use crate::auth::middleware::AuthUser;
use crate::error::{AppError, AppResult};
use crate::models::EmbedTemplate;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/{id}/embed-templates",
            get(list_embed_templates).post(create_embed_template),
        )
        .route(
            "/{id}/embed-templates/{eid}",
            delete(delete_embed_template),
        )
}

// ── GET /guilds/:id/embed-templates ─────────────────────────────────────────

async fn list_embed_templates(
    State(state): State<AppState>,
    _user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<Vec<EmbedTemplate>>> {
    let templates = sqlx::query_as::<_, EmbedTemplate>(
        "SELECT * FROM embed_templates WHERE guild_id = ? ORDER BY name ASC",
    )
    .bind(&id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(templates))
}

// ── POST /guilds/:id/embed-templates ────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateEmbedTemplateBody {
    pub name: String,
    /// JSON-encoded embed object.
    pub embed: serde_json::Value,
}

async fn create_embed_template(
    State(state): State<AppState>,
    _user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<CreateEmbedTemplateBody>,
) -> AppResult<Json<EmbedTemplate>> {
    let embed_str = serde_json::to_string(&body.embed)
        .map_err(|e| AppError::BadRequest(format!("Invalid embed JSON: {e}")))?;

    sqlx::query(
        "INSERT INTO embed_templates (guild_id, name, embed) VALUES (?, ?, ?)",
    )
    .bind(&id)
    .bind(&body.name)
    .bind(&embed_str)
    .execute(&state.db)
    .await
    .map_err(|e| match e {
        sqlx::Error::Database(ref db_err) if db_err.message().contains("UNIQUE") => {
            AppError::BadRequest(format!(
                "Embed template '{}' already exists in this guild",
                body.name
            ))
        }
        other => AppError::Database(other),
    })?;

    let template = sqlx::query_as::<_, EmbedTemplate>(
        "SELECT * FROM embed_templates WHERE id = last_insert_rowid()",
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(template))
}

// ── DELETE /guilds/:id/embed-templates/:eid ─────────────────────────────────

async fn delete_embed_template(
    State(state): State<AppState>,
    _user: AuthUser,
    Path((id, eid)): Path<(String, i64)>,
) -> AppResult<Json<serde_json::Value>> {
    let result = sqlx::query(
        "DELETE FROM embed_templates WHERE guild_id = ? AND id = ?",
    )
    .bind(&id)
    .bind(eid)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!(
            "Embed template {eid} not found"
        )));
    }

    Ok(Json(json!({ "deleted": true, "id": eid })))
}
