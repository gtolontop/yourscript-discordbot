use axum::{
    extract::{Path, State},
    routing::{delete, get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;

use crate::auth::middleware::AuthUser;
use crate::error::{AppError, AppResult};
use crate::models::Giveaway;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/{id}/giveaways", get(list_giveaways).post(create_giveaway))
        .route("/{id}/giveaways/{gid}", delete(delete_giveaway))
        .route("/{id}/giveaways/{gid}/end", post(end_giveaway))
        .route("/{id}/giveaways/{gid}/reroll", post(reroll_giveaway))
        .route("/{id}/giveaways/{gid}/enter", post(enter_giveaway))
}

// ── GET /guilds/:id/giveaways ───────────────────────────────────────────────

async fn list_giveaways(
    State(state): State<AppState>,
    _user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<Vec<Giveaway>>> {
    let giveaways = sqlx::query_as::<_, Giveaway>(
        "SELECT * FROM giveaways WHERE guild_id = ? ORDER BY created_at DESC",
    )
    .bind(&id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(giveaways))
}

// ── POST /guilds/:id/giveaways ──────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateGiveawayBody {
    pub channel_id: String,
    pub message_id: String,
    pub prize: String,
    pub winners: Option<i64>,
    pub required_role: Option<String>,
    pub ends_at: String,
}

async fn create_giveaway(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<CreateGiveawayBody>,
) -> AppResult<Json<Giveaway>> {
    sqlx::query(
        "INSERT INTO giveaways (guild_id, channel_id, message_id, host_id, prize, winners, required_role, ends_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&body.channel_id)
    .bind(&body.message_id)
    .bind(&user.id)
    .bind(&body.prize)
    .bind(body.winners.unwrap_or(1))
    .bind(&body.required_role)
    .bind(&body.ends_at)
    .execute(&state.db)
    .await?;

    let giveaway = sqlx::query_as::<_, Giveaway>(
        "SELECT * FROM giveaways WHERE id = last_insert_rowid()",
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(giveaway))
}

// ── DELETE /guilds/:id/giveaways/:gid ───────────────────────────────────────

async fn delete_giveaway(
    State(state): State<AppState>,
    _user: AuthUser,
    Path((id, gid)): Path<(String, i64)>,
) -> AppResult<Json<serde_json::Value>> {
    let result = sqlx::query("DELETE FROM giveaways WHERE guild_id = ? AND id = ?")
        .bind(&id)
        .bind(gid)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Giveaway {gid} not found")));
    }

    Ok(Json(json!({ "deleted": true, "id": gid })))
}

// ── POST /guilds/:id/giveaways/:gid/end ────────────────────────────────────

async fn end_giveaway(
    State(state): State<AppState>,
    _user: AuthUser,
    Path((id, gid)): Path<(String, i64)>,
) -> AppResult<Json<Giveaway>> {
    let giveaway = sqlx::query_as::<_, Giveaway>(
        "SELECT * FROM giveaways WHERE guild_id = ? AND id = ?",
    )
    .bind(&id)
    .bind(gid)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Giveaway {gid} not found")))?;

    if giveaway.ended == 1 {
        return Err(AppError::BadRequest("Giveaway already ended".to_string()));
    }

    // Pick random winners from participants
    let participants: Vec<String> = serde_json::from_str(&giveaway.participants).unwrap_or_default();
    let winner_ids = pick_winners(&participants, giveaway.winners as usize);
    let winner_json = serde_json::to_string(&winner_ids)
        .unwrap_or_else(|_| "[]".to_string());

    sqlx::query(
        "UPDATE giveaways SET ended = 1, winner_ids = ? WHERE guild_id = ? AND id = ?",
    )
    .bind(&winner_json)
    .bind(&id)
    .bind(gid)
    .execute(&state.db)
    .await?;

    let updated = sqlx::query_as::<_, Giveaway>(
        "SELECT * FROM giveaways WHERE guild_id = ? AND id = ?",
    )
    .bind(&id)
    .bind(gid)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(updated))
}

// ── POST /guilds/:id/giveaways/:gid/reroll ──────────────────────────────────

async fn reroll_giveaway(
    State(state): State<AppState>,
    _user: AuthUser,
    Path((id, gid)): Path<(String, i64)>,
) -> AppResult<Json<Giveaway>> {
    let giveaway = sqlx::query_as::<_, Giveaway>(
        "SELECT * FROM giveaways WHERE guild_id = ? AND id = ?",
    )
    .bind(&id)
    .bind(gid)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Giveaway {gid} not found")))?;

    if giveaway.ended == 0 {
        return Err(AppError::BadRequest(
            "Cannot reroll a giveaway that has not ended".to_string(),
        ));
    }

    let participants: Vec<String> = serde_json::from_str(&giveaway.participants).unwrap_or_default();
    let winner_ids = pick_winners(&participants, giveaway.winners as usize);
    let winner_json = serde_json::to_string(&winner_ids)
        .unwrap_or_else(|_| "[]".to_string());

    sqlx::query("UPDATE giveaways SET winner_ids = ? WHERE guild_id = ? AND id = ?")
        .bind(&winner_json)
        .bind(&id)
        .bind(gid)
        .execute(&state.db)
        .await?;

    let updated = sqlx::query_as::<_, Giveaway>(
        "SELECT * FROM giveaways WHERE guild_id = ? AND id = ?",
    )
    .bind(&id)
    .bind(gid)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(updated))
}

// ── POST /guilds/:id/giveaways/:gid/enter ───────────────────────────────────

async fn enter_giveaway(
    State(state): State<AppState>,
    user: AuthUser,
    Path((id, gid)): Path<(String, i64)>,
) -> AppResult<Json<serde_json::Value>> {
    let giveaway = sqlx::query_as::<_, Giveaway>(
        "SELECT * FROM giveaways WHERE guild_id = ? AND id = ?",
    )
    .bind(&id)
    .bind(gid)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Giveaway {gid} not found")))?;

    if giveaway.ended == 1 {
        return Err(AppError::BadRequest("Giveaway has already ended".to_string()));
    }

    let mut participants: Vec<String> =
        serde_json::from_str(&giveaway.participants).unwrap_or_default();

    if participants.contains(&user.id) {
        return Err(AppError::BadRequest("Already entered this giveaway".to_string()));
    }

    participants.push(user.id.clone());
    let participants_json = serde_json::to_string(&participants)
        .unwrap_or_else(|_| "[]".to_string());

    sqlx::query("UPDATE giveaways SET participants = ? WHERE guild_id = ? AND id = ?")
        .bind(&participants_json)
        .bind(&id)
        .bind(gid)
        .execute(&state.db)
        .await?;

    Ok(Json(json!({
        "entered": true,
        "user_id": user.id,
        "total_participants": participants.len(),
    })))
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/// Pick `count` random winners from a list of participant IDs.
fn pick_winners(participants: &[String], count: usize) -> Vec<String> {
    use std::collections::HashSet;

    if participants.is_empty() || count == 0 {
        return Vec::new();
    }

    let count = count.min(participants.len());
    let mut winners = HashSet::new();

    // Simple random selection using timestamp-based seed
    let seed = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();

    let mut rng_state = seed as u64;
    while winners.len() < count {
        // xorshift64
        rng_state ^= rng_state << 13;
        rng_state ^= rng_state >> 7;
        rng_state ^= rng_state << 17;
        let idx = (rng_state as usize) % participants.len();
        winners.insert(idx);
    }

    winners.into_iter().map(|i| participants[i].clone()).collect()
}
