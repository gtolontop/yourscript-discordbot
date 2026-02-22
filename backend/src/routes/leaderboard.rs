use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use serde::Deserialize;

use crate::auth::middleware::AuthUser;
use crate::error::AppResult;
use crate::models::User;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/{id}/leaderboard", get(get_leaderboard))
}

// ── Query params ────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct LeaderboardQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

// ── GET /guilds/:id/leaderboard ─────────────────────────────────────────────

/// Return the top users by XP. Since users are global (not per-guild in the
/// current schema), this returns the global leaderboard. If a per-guild XP
/// table is added later, this can be adjusted.
async fn get_leaderboard(
    State(state): State<AppState>,
    _user: AuthUser,
    Path(_id): Path<String>,
    Query(params): Query<LeaderboardQuery>,
) -> AppResult<Json<Vec<User>>> {
    let limit = params.limit.unwrap_or(25).clamp(1, 100);
    let offset = params.offset.unwrap_or(0).max(0);

    let users = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE visible_xp = 1 ORDER BY xp DESC LIMIT ? OFFSET ?",
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(users))
}
