use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;

use crate::auth::middleware::AuthUser;
use crate::error::{AppError, AppResult};
use crate::models::Suggestion;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/{id}/suggestions",
            get(list_suggestions).post(create_suggestion),
        )
        .route("/{id}/suggestions/{sid}/vote", post(vote_suggestion))
        .route("/{id}/suggestions/{sid}/approve", post(approve_suggestion))
        .route("/{id}/suggestions/{sid}/reject", post(reject_suggestion))
}

// ── GET /guilds/:id/suggestions ─────────────────────────────────────────────

async fn list_suggestions(
    State(state): State<AppState>,
    _user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<Vec<Suggestion>>> {
    let suggestions = sqlx::query_as::<_, Suggestion>(
        "SELECT * FROM suggestions WHERE guild_id = ? ORDER BY created_at DESC",
    )
    .bind(&id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(suggestions))
}

// ── POST /guilds/:id/suggestions ────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateSuggestionBody {
    pub content: String,
    pub message_id: String,
}

async fn create_suggestion(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<CreateSuggestionBody>,
) -> AppResult<Json<Suggestion>> {
    sqlx::query(
        "INSERT INTO suggestions (guild_id, user_id, message_id, content) VALUES (?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&user.id)
    .bind(&body.message_id)
    .bind(&body.content)
    .execute(&state.db)
    .await?;

    let suggestion = sqlx::query_as::<_, Suggestion>(
        "SELECT * FROM suggestions WHERE id = last_insert_rowid()",
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(suggestion))
}

// ── POST /guilds/:id/suggestions/:sid/vote ──────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct VoteBody {
    pub vote: String, // "up" or "down"
}

async fn vote_suggestion(
    State(state): State<AppState>,
    _user: AuthUser,
    Path((id, sid)): Path<(String, i64)>,
    Json(body): Json<VoteBody>,
) -> AppResult<Json<Suggestion>> {
    match body.vote.as_str() {
        "up" => {
            let result = sqlx::query(
                "UPDATE suggestions SET upvotes = upvotes + 1 WHERE guild_id = ? AND id = ?",
            )
            .bind(&id)
            .bind(sid)
            .execute(&state.db)
            .await?;

            if result.rows_affected() == 0 {
                return Err(AppError::NotFound(format!("Suggestion {sid} not found")));
            }
        }
        "down" => {
            let result = sqlx::query(
                "UPDATE suggestions SET downvotes = downvotes + 1 WHERE guild_id = ? AND id = ?",
            )
            .bind(&id)
            .bind(sid)
            .execute(&state.db)
            .await?;

            if result.rows_affected() == 0 {
                return Err(AppError::NotFound(format!("Suggestion {sid} not found")));
            }
        }
        _ => {
            return Err(AppError::BadRequest(
                "Vote must be 'up' or 'down'".to_string(),
            ));
        }
    }

    let suggestion = sqlx::query_as::<_, Suggestion>(
        "SELECT * FROM suggestions WHERE guild_id = ? AND id = ?",
    )
    .bind(&id)
    .bind(sid)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(suggestion))
}

// ── POST /guilds/:id/suggestions/:sid/approve ───────────────────────────────

#[derive(Debug, Deserialize)]
pub struct StaffActionBody {
    pub reason: Option<String>,
}

async fn approve_suggestion(
    State(state): State<AppState>,
    user: AuthUser,
    Path((id, sid)): Path<(String, i64)>,
    body: Option<Json<StaffActionBody>>,
) -> AppResult<Json<Suggestion>> {
    let reason = body.and_then(|b| b.reason.clone());

    let result = sqlx::query(
        "UPDATE suggestions SET status = 'approved', staff_id = ?, staff_reason = ? \
         WHERE guild_id = ? AND id = ?",
    )
    .bind(&user.id)
    .bind(&reason)
    .bind(&id)
    .bind(sid)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Suggestion {sid} not found")));
    }

    let suggestion = sqlx::query_as::<_, Suggestion>(
        "SELECT * FROM suggestions WHERE guild_id = ? AND id = ?",
    )
    .bind(&id)
    .bind(sid)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(suggestion))
}

// ── POST /guilds/:id/suggestions/:sid/reject ────────────────────────────────

async fn reject_suggestion(
    State(state): State<AppState>,
    user: AuthUser,
    Path((id, sid)): Path<(String, i64)>,
    body: Option<Json<StaffActionBody>>,
) -> AppResult<Json<Suggestion>> {
    let reason = body.and_then(|b| b.reason.clone());

    let result = sqlx::query(
        "UPDATE suggestions SET status = 'rejected', staff_id = ?, staff_reason = ? \
         WHERE guild_id = ? AND id = ?",
    )
    .bind(&user.id)
    .bind(&reason)
    .bind(&id)
    .bind(sid)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Suggestion {sid} not found")));
    }

    let suggestion = sqlx::query_as::<_, Suggestion>(
        "SELECT * FROM suggestions WHERE guild_id = ? AND id = ?",
    )
    .bind(&id)
    .bind(sid)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(suggestion))
}
