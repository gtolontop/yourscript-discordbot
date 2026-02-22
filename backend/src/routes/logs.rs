use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;

use crate::auth::middleware::AuthUser;
use crate::error::AppResult;
use crate::models::DashboardLog;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/{id}/logs", get(list_logs))
}

// ── Query params ────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct LogsQuery {
    pub page: Option<i64>,
    pub limit: Option<i64>,
    pub action: Option<String>,
}

// ── GET /guilds/:id/logs ────────────────────────────────────────────────────

async fn list_logs(
    State(state): State<AppState>,
    _user: AuthUser,
    Path(id): Path<String>,
    Query(params): Query<LogsQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let page = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(50).clamp(1, 200);
    let offset = (page - 1) * limit;

    let (logs, total) = if let Some(ref action) = params.action {
        let logs = sqlx::query_as::<_, DashboardLog>(
            "SELECT * FROM dashboard_logs WHERE guild_id = ? AND action = ? \
             ORDER BY created_at DESC LIMIT ? OFFSET ?",
        )
        .bind(&id)
        .bind(action)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await?;

        let total: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM dashboard_logs WHERE guild_id = ? AND action = ?",
        )
        .bind(&id)
        .bind(action)
        .fetch_one(&state.db)
        .await?;

        (logs, total.0)
    } else {
        let logs = sqlx::query_as::<_, DashboardLog>(
            "SELECT * FROM dashboard_logs WHERE guild_id = ? \
             ORDER BY created_at DESC LIMIT ? OFFSET ?",
        )
        .bind(&id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await?;

        let total: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM dashboard_logs WHERE guild_id = ?",
        )
        .bind(&id)
        .fetch_one(&state.db)
        .await?;

        (logs, total.0)
    };

    Ok(Json(json!({
        "logs": logs,
        "total": total,
        "page": page,
        "limit": limit,
    })))
}
