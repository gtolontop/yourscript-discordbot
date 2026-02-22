use axum::{
    extract::{Path, Query, State},
    routing::{delete, get, post, put},
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;

use crate::auth::middleware::AuthUser;
use crate::error::{AppError, AppResult};
use crate::models::{Ticket, TicketBlacklist, TicketCategory};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        // Tickets
        .route("/{id}/tickets", get(list_tickets))
        .route("/{id}/tickets/{tid}", get(get_ticket))
        .route("/{id}/tickets/{tid}/close", post(close_ticket))
        .route("/{id}/tickets/{tid}/claim", post(claim_ticket))
        .route("/{id}/tickets/{tid}/priority", put(update_priority))
        // Ticket categories
        .route(
            "/{id}/ticket-categories",
            get(list_categories).post(create_category),
        )
        .route("/{id}/ticket-categories/{cid}", delete(delete_category))
        // Ticket blacklist
        .route(
            "/{id}/ticket-blacklist",
            get(list_blacklist).post(add_to_blacklist),
        )
        .route("/{id}/ticket-blacklist/{bid}", delete(remove_from_blacklist))
}

// ── Pagination ──────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct PaginationParams {
    pub page: Option<i64>,
    pub limit: Option<i64>,
    pub status: Option<String>,
}

// ── GET /guilds/:id/tickets ─────────────────────────────────────────────────

async fn list_tickets(
    State(state): State<AppState>,
    _user: AuthUser,
    Path(id): Path<String>,
    Query(params): Query<PaginationParams>,
) -> AppResult<Json<serde_json::Value>> {
    let page = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(25).clamp(1, 100);
    let offset = (page - 1) * limit;

    let (tickets, total) = if let Some(ref status) = params.status {
        let tickets = sqlx::query_as::<_, Ticket>(
            "SELECT * FROM tickets WHERE guild_id = ? AND status = ? \
             ORDER BY created_at DESC LIMIT ? OFFSET ?",
        )
        .bind(&id)
        .bind(status)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await?;

        let total: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM tickets WHERE guild_id = ? AND status = ?",
        )
        .bind(&id)
        .bind(status)
        .fetch_one(&state.db)
        .await?;

        (tickets, total.0)
    } else {
        let tickets = sqlx::query_as::<_, Ticket>(
            "SELECT * FROM tickets WHERE guild_id = ? \
             ORDER BY created_at DESC LIMIT ? OFFSET ?",
        )
        .bind(&id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await?;

        let total: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM tickets WHERE guild_id = ?")
                .bind(&id)
                .fetch_one(&state.db)
                .await?;

        (tickets, total.0)
    };

    Ok(Json(json!({
        "tickets": tickets,
        "total": total,
        "page": page,
        "limit": limit,
    })))
}

// ── GET /guilds/:id/tickets/:tid ────────────────────────────────────────────

async fn get_ticket(
    State(state): State<AppState>,
    _user: AuthUser,
    Path((id, tid)): Path<(String, i64)>,
) -> AppResult<Json<Ticket>> {
    let ticket = sqlx::query_as::<_, Ticket>(
        "SELECT * FROM tickets WHERE guild_id = ? AND id = ?",
    )
    .bind(&id)
    .bind(tid)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Ticket {tid} not found")))?;

    Ok(Json(ticket))
}

// ── POST /guilds/:id/tickets/:tid/close ─────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CloseTicketBody {
    pub closed_by: Option<String>,
}

async fn close_ticket(
    State(state): State<AppState>,
    user: AuthUser,
    Path((id, tid)): Path<(String, i64)>,
    body: Option<Json<CloseTicketBody>>,
) -> AppResult<Json<Ticket>> {
    let closed_by = body
        .and_then(|b| b.closed_by.clone())
        .unwrap_or_else(|| user.id.clone());

    let result = sqlx::query(
        "UPDATE tickets SET status = 'closed', closed_by = ?, closed_at = datetime('now'), \
         last_activity = datetime('now') WHERE guild_id = ? AND id = ? AND status = 'open'",
    )
    .bind(&closed_by)
    .bind(&id)
    .bind(tid)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(
            "Ticket not found or already closed".to_string(),
        ));
    }

    let ticket = sqlx::query_as::<_, Ticket>(
        "SELECT * FROM tickets WHERE guild_id = ? AND id = ?",
    )
    .bind(&id)
    .bind(tid)
    .fetch_one(&state.db)
    .await?;

    // Broadcast update via WebSocket
    let _ = state.ws_tx.send(crate::state::WsEvent::TicketUpdate {
        guild_id: id,
        ticket_id: tid,
        status: "closed".to_string(),
    });

    Ok(Json(ticket))
}

// ── POST /guilds/:id/tickets/:tid/claim ─────────────────────────────────────

async fn claim_ticket(
    State(state): State<AppState>,
    user: AuthUser,
    Path((id, tid)): Path<(String, i64)>,
) -> AppResult<Json<Ticket>> {
    let result = sqlx::query(
        "UPDATE tickets SET claimed_by = ?, last_activity = datetime('now') \
         WHERE guild_id = ? AND id = ? AND claimed_by IS NULL",
    )
    .bind(&user.id)
    .bind(&id)
    .bind(tid)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::BadRequest(
            "Ticket not found or already claimed".to_string(),
        ));
    }

    let ticket = sqlx::query_as::<_, Ticket>(
        "SELECT * FROM tickets WHERE guild_id = ? AND id = ?",
    )
    .bind(&id)
    .bind(tid)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(ticket))
}

// ── PUT /guilds/:id/tickets/:tid/priority ───────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct UpdatePriorityBody {
    pub priority: String,
}

async fn update_priority(
    State(state): State<AppState>,
    _user: AuthUser,
    Path((id, tid)): Path<(String, i64)>,
    Json(body): Json<UpdatePriorityBody>,
) -> AppResult<Json<Ticket>> {
    let valid = ["low", "normal", "high", "urgent"];
    if !valid.contains(&body.priority.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Invalid priority '{}'. Must be one of: {}",
            body.priority,
            valid.join(", ")
        )));
    }

    let result = sqlx::query(
        "UPDATE tickets SET priority = ?, last_activity = datetime('now') \
         WHERE guild_id = ? AND id = ?",
    )
    .bind(&body.priority)
    .bind(&id)
    .bind(tid)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Ticket {tid} not found")));
    }

    let ticket = sqlx::query_as::<_, Ticket>(
        "SELECT * FROM tickets WHERE guild_id = ? AND id = ?",
    )
    .bind(&id)
    .bind(tid)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(ticket))
}

// ── GET /guilds/:id/ticket-categories ───────────────────────────────────────

async fn list_categories(
    State(state): State<AppState>,
    _user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<Vec<TicketCategory>>> {
    let categories = sqlx::query_as::<_, TicketCategory>(
        "SELECT * FROM ticket_categories WHERE guild_id = ? ORDER BY name ASC",
    )
    .bind(&id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(categories))
}

// ── POST /guilds/:id/ticket-categories ──────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateCategoryBody {
    pub name: String,
    pub emoji: Option<String>,
    pub description: Option<String>,
}

async fn create_category(
    State(state): State<AppState>,
    _user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<CreateCategoryBody>,
) -> AppResult<Json<TicketCategory>> {
    sqlx::query(
        "INSERT INTO ticket_categories (guild_id, name, emoji, description) VALUES (?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&body.name)
    .bind(&body.emoji)
    .bind(&body.description)
    .execute(&state.db)
    .await
    .map_err(|e| match e {
        sqlx::Error::Database(ref db_err) if db_err.message().contains("UNIQUE") => {
            AppError::BadRequest(format!("Category '{}' already exists", body.name))
        }
        other => AppError::Database(other),
    })?;

    let category = sqlx::query_as::<_, TicketCategory>(
        "SELECT * FROM ticket_categories WHERE id = last_insert_rowid()",
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(category))
}

// ── DELETE /guilds/:id/ticket-categories/:cid ───────────────────────────────

async fn delete_category(
    State(state): State<AppState>,
    _user: AuthUser,
    Path((id, cid)): Path<(String, i64)>,
) -> AppResult<Json<serde_json::Value>> {
    let result = sqlx::query(
        "DELETE FROM ticket_categories WHERE guild_id = ? AND id = ?",
    )
    .bind(&id)
    .bind(cid)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Category {cid} not found")));
    }

    Ok(Json(json!({ "deleted": true, "id": cid })))
}

// ── GET /guilds/:id/ticket-blacklist ────────────────────────────────────────

async fn list_blacklist(
    State(state): State<AppState>,
    _user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<Vec<TicketBlacklist>>> {
    let list = sqlx::query_as::<_, TicketBlacklist>(
        "SELECT * FROM ticket_blacklists WHERE guild_id = ? ORDER BY created_at DESC",
    )
    .bind(&id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(list))
}

// ── POST /guilds/:id/ticket-blacklist ───────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct AddBlacklistBody {
    pub user_id: String,
    pub reason: Option<String>,
}

async fn add_to_blacklist(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<AddBlacklistBody>,
) -> AppResult<Json<TicketBlacklist>> {
    sqlx::query(
        "INSERT INTO ticket_blacklists (guild_id, user_id, reason, added_by) VALUES (?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&body.user_id)
    .bind(&body.reason)
    .bind(&user.id)
    .execute(&state.db)
    .await
    .map_err(|e| match e {
        sqlx::Error::Database(ref db_err) if db_err.message().contains("UNIQUE") => {
            AppError::BadRequest("User is already blacklisted".to_string())
        }
        other => AppError::Database(other),
    })?;

    let entry = sqlx::query_as::<_, TicketBlacklist>(
        "SELECT * FROM ticket_blacklists WHERE id = last_insert_rowid()",
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(entry))
}

// ── DELETE /guilds/:id/ticket-blacklist/:bid ────────────────────────────────

async fn remove_from_blacklist(
    State(state): State<AppState>,
    _user: AuthUser,
    Path((id, bid)): Path<(String, i64)>,
) -> AppResult<Json<serde_json::Value>> {
    let result = sqlx::query(
        "DELETE FROM ticket_blacklists WHERE guild_id = ? AND id = ?",
    )
    .bind(&id)
    .bind(bid)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!(
            "Blacklist entry {bid} not found"
        )));
    }

    Ok(Json(json!({ "deleted": true, "id": bid })))
}
