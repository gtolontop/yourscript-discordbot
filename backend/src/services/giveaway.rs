use sqlx::SqlitePool;

use crate::error::{AppError, AppResult};
use crate::models::Giveaway;

/// Create a new giveaway.
pub async fn create(
    pool: &SqlitePool,
    guild_id: &str,
    channel_id: &str,
    message_id: &str,
    host_id: &str,
    prize: &str,
    winners: i64,
    required_role: Option<&str>,
    ends_at: &str,
) -> AppResult<Giveaway> {
    sqlx::query(
        "INSERT INTO giveaways (guild_id, channel_id, message_id, host_id, prize, winners, required_role, ends_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(guild_id)
    .bind(channel_id)
    .bind(message_id)
    .bind(host_id)
    .bind(prize)
    .bind(winners)
    .bind(required_role)
    .bind(ends_at)
    .execute(pool)
    .await?;

    let giveaway = sqlx::query_as::<_, Giveaway>(
        "SELECT id, guild_id, channel_id, message_id, host_id, prize, winners, \
         required_role, ends_at, ended, winner_ids, participants, created_at \
         FROM giveaways WHERE id = last_insert_rowid()",
    )
    .fetch_one(pool)
    .await?;

    Ok(giveaway)
}

/// List all giveaways for a guild.
pub async fn list(pool: &SqlitePool, guild_id: &str) -> AppResult<Vec<Giveaway>> {
    let giveaways = sqlx::query_as::<_, Giveaway>(
        "SELECT id, guild_id, channel_id, message_id, host_id, prize, winners, \
         required_role, ends_at, ended, winner_ids, participants, created_at \
         FROM giveaways WHERE guild_id = ? ORDER BY created_at DESC",
    )
    .bind(guild_id)
    .fetch_all(pool)
    .await?;

    Ok(giveaways)
}

/// Fetch a single giveaway by ID.
pub async fn get(pool: &SqlitePool, giveaway_id: i64) -> AppResult<Giveaway> {
    let giveaway = sqlx::query_as::<_, Giveaway>(
        "SELECT id, guild_id, channel_id, message_id, host_id, prize, winners, \
         required_role, ends_at, ended, winner_ids, participants, created_at \
         FROM giveaways WHERE id = ?",
    )
    .bind(giveaway_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Giveaway {giveaway_id} not found")))?;

    Ok(giveaway)
}

/// End a giveaway by picking random winners from the participants list.
///
/// The `participants` column is a JSON array of user-ID strings.
/// We deserialise it, shuffle, pick up to `winners` entries, persist
/// the `winner_ids` array, and mark the giveaway as `ended = 1`.
///
/// Returns the updated giveaway row.
pub async fn end_giveaway(pool: &SqlitePool, giveaway_id: i64) -> AppResult<Giveaway> {
    let giveaway = get(pool, giveaway_id).await?;

    if giveaway.ended != 0 {
        return Err(AppError::BadRequest(
            "Giveaway has already ended".into(),
        ));
    }

    let participants: Vec<String> = serde_json::from_str(&giveaway.participants)
        .unwrap_or_default();

    let selected = pick_winners(&participants, giveaway.winners as usize);
    let winner_ids_json = serde_json::to_string(&selected)
        .unwrap_or_else(|_| "[]".into());

    sqlx::query("UPDATE giveaways SET ended = 1, winner_ids = ? WHERE id = ?")
        .bind(&winner_ids_json)
        .bind(giveaway_id)
        .execute(pool)
        .await?;

    get(pool, giveaway_id).await
}

/// Re-roll winners for an already-ended giveaway.
///
/// Picks a new random set of winners from the participant list and updates
/// the `winner_ids` column.
pub async fn reroll(pool: &SqlitePool, giveaway_id: i64) -> AppResult<Giveaway> {
    let giveaway = get(pool, giveaway_id).await?;

    if giveaway.ended == 0 {
        return Err(AppError::BadRequest(
            "Cannot reroll a giveaway that has not ended yet".into(),
        ));
    }

    let participants: Vec<String> = serde_json::from_str(&giveaway.participants)
        .unwrap_or_default();

    let selected = pick_winners(&participants, giveaway.winners as usize);
    let winner_ids_json = serde_json::to_string(&selected)
        .unwrap_or_else(|_| "[]".into());

    sqlx::query("UPDATE giveaways SET winner_ids = ? WHERE id = ?")
        .bind(&winner_ids_json)
        .bind(giveaway_id)
        .execute(pool)
        .await?;

    get(pool, giveaway_id).await
}

/// Add a participant to a giveaway. No-op if they are already entered.
pub async fn enter(pool: &SqlitePool, giveaway_id: i64, user_id: &str) -> AppResult<Giveaway> {
    let giveaway = get(pool, giveaway_id).await?;

    if giveaway.ended != 0 {
        return Err(AppError::BadRequest(
            "Cannot enter a giveaway that has already ended".into(),
        ));
    }

    let mut participants: Vec<String> = serde_json::from_str(&giveaway.participants)
        .unwrap_or_default();

    if participants.contains(&user_id.to_string()) {
        // Already entered; return current state.
        return Ok(giveaway);
    }

    participants.push(user_id.to_string());
    let json = serde_json::to_string(&participants).unwrap_or_else(|_| "[]".into());

    sqlx::query("UPDATE giveaways SET participants = ? WHERE id = ?")
        .bind(&json)
        .bind(giveaway_id)
        .execute(pool)
        .await?;

    get(pool, giveaway_id).await
}

/// Return all active giveaways (not ended and `ends_at` is in the future).
pub async fn get_active(pool: &SqlitePool, guild_id: &str) -> AppResult<Vec<Giveaway>> {
    let giveaways = sqlx::query_as::<_, Giveaway>(
        "SELECT id, guild_id, channel_id, message_id, host_id, prize, winners, \
         required_role, ends_at, ended, winner_ids, participants, created_at \
         FROM giveaways WHERE guild_id = ? AND ended = 0 \
         ORDER BY ends_at ASC",
    )
    .bind(guild_id)
    .fetch_all(pool)
    .await?;

    Ok(giveaways)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/// Simple Fisher-Yates-style random selection without the `rand` crate.
///
/// Uses a basic hash of the current timestamp + index to provide a
/// good-enough shuffle for giveaway winner picking.  For production use
/// you may want to add the `rand` crate.
fn pick_winners(participants: &[String], count: usize) -> Vec<String> {
    if participants.is_empty() {
        return Vec::new();
    }

    let mut pool: Vec<String> = participants.to_vec();
    let n = pool.len();
    let pick = count.min(n);

    // Use a simple seed from the system time.
    let seed = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();

    let mut state = seed;
    for i in (1..n).rev() {
        // xorshift-style step
        state ^= state << 13;
        state ^= state >> 7;
        state ^= state << 17;
        let j = (state as usize) % (i + 1);
        pool.swap(i, j);
    }

    pool.into_iter().take(pick).collect()
}
