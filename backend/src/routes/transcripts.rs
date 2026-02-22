use axum::{
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::{Html, IntoResponse, Response},
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;

use crate::auth::middleware::AuthUser;
use crate::error::{AppError, AppResult};
use crate::models::Transcript;
use crate::state::AppState;

/// Router nested under /guilds/:id
pub fn guild_router() -> Router<AppState> {
    Router::new().route("/{id}/transcripts", get(list_transcripts))
}

// ── GET /guilds/:id/transcripts ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct TranscriptListQuery {
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

async fn list_transcripts(
    State(state): State<AppState>,
    _user: AuthUser,
    Path(id): Path<String>,
    Query(params): Query<TranscriptListQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let page = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(25).clamp(1, 100);
    let offset = (page - 1) * limit;

    // Fetch transcripts without the full HTML body for the list view
    let transcripts = sqlx::query_as::<_, TranscriptSummary>(
        "SELECT id, ticket_id, ticket_number, guild_id, guild_name, user_id, user_name, \
         closed_by, closed_by_name, subject, category, message_count, created_at \
         FROM transcripts WHERE guild_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
    )
    .bind(&id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    let total: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM transcripts WHERE guild_id = ?",
    )
    .bind(&id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(json!({
        "transcripts": transcripts,
        "total": total.0,
        "page": page,
        "limit": limit,
    })))
}

/// Summary view of a transcript (without the HTML body).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct TranscriptSummary {
    pub id: String,
    pub ticket_id: i64,
    pub ticket_number: i64,
    pub guild_id: String,
    pub guild_name: String,
    pub user_id: String,
    pub user_name: String,
    pub closed_by: String,
    pub closed_by_name: String,
    pub subject: Option<String>,
    pub category: Option<String>,
    pub message_count: i64,
    pub created_at: String,
}

// ── GET /transcript/:id ─────────────────────────────────────────────────────

/// Serve the transcript HTML for viewing. Requires authentication.
pub async fn view_transcript(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Response> {
    let transcript = sqlx::query_as::<_, Transcript>(
        "SELECT * FROM transcripts WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Transcript not found".to_string()))?;

    // Optionally verify the user has access to this transcript's guild.
    // For now, any authenticated user can view transcripts they have a link to.

    Ok(Html(transcript.html).into_response())
}
