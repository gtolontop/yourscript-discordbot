use sqlx::SqlitePool;
use tokio::time::{interval, Duration};

use crate::error::AppResult;
use crate::models::{Giveaway, Reminder, TempPunishment};

/// Main scheduler loop - runs every 30 seconds checking for due items.
pub async fn run_scheduler(pool: &SqlitePool) {
    let mut ticker = interval(Duration::from_secs(30));

    loop {
        ticker.tick().await;

        // Check expired temp punishments
        match check_temp_punishments(pool).await {
            Ok(expired) if !expired.is_empty() => {
                tracing::info!("Scheduler: {} expired temp punishment(s) processed", expired.len());
            }
            Err(e) => tracing::error!("Scheduler: temp punishment check failed: {e}"),
            _ => {}
        }

        // Check giveaways that need ending
        match check_giveaways(pool).await {
            Ok(due) if !due.is_empty() => {
                for giveaway in &due {
                    if let Err(e) = crate::services::giveaway::end_giveaway(pool, giveaway.id).await {
                        tracing::error!("Scheduler: failed to end giveaway {}: {e}", giveaway.id);
                    }
                }
                tracing::info!("Scheduler: {} giveaway(s) ended", due.len());
            }
            Err(e) => tracing::error!("Scheduler: giveaway check failed: {e}"),
            _ => {}
        }

        // Check due reminders
        match check_reminders(pool).await {
            Ok(due) if !due.is_empty() => {
                tracing::info!("Scheduler: {} reminder(s) due (bot will deliver)", due.len());
                // Note: actual delivery is done by the bot via polling /api/v1/bot/reminders
            }
            Err(e) => tracing::error!("Scheduler: reminder check failed: {e}"),
            _ => {}
        }
    }
}

/// Check for expired temporary punishments (bans/mutes).
///
/// Returns all rows whose `expires_at` is in the past, then deletes them so
/// they are not processed again.
pub async fn check_temp_punishments(pool: &SqlitePool) -> AppResult<Vec<TempPunishment>> {
    let expired = sqlx::query_as::<_, TempPunishment>(
        "SELECT id, guild_id, user_id, punishment_type, expires_at, created_at \
         FROM temp_punishments WHERE expires_at <= datetime('now')",
    )
    .fetch_all(pool)
    .await?;

    if !expired.is_empty() {
        sqlx::query("DELETE FROM temp_punishments WHERE expires_at <= datetime('now')")
            .execute(pool)
            .await?;
    }

    Ok(expired)
}

/// Check for giveaways that should have ended.
///
/// Returns giveaways where `ends_at` is in the past and `ended = 0`.
/// The caller is responsible for actually ending them (calling
/// `giveaway::end_giveaway`).
pub async fn check_giveaways(pool: &SqlitePool) -> AppResult<Vec<Giveaway>> {
    let due = sqlx::query_as::<_, Giveaway>(
        "SELECT id, guild_id, channel_id, message_id, host_id, prize, winners, \
         required_role, ends_at, ended, winner_ids, participants, created_at \
         FROM giveaways WHERE ended = 0 AND ends_at <= datetime('now')",
    )
    .fetch_all(pool)
    .await?;

    Ok(due)
}

/// Check for reminders that are due.
///
/// Returns all reminder rows whose `remind_at` is in the past, then deletes
/// them so they are not fired again.
pub async fn check_reminders(pool: &SqlitePool) -> AppResult<Vec<Reminder>> {
    let due = sqlx::query_as::<_, Reminder>(
        "SELECT id, user_id, guild_id, channel_id, message, remind_at, created_at \
         FROM reminders WHERE remind_at <= datetime('now')",
    )
    .fetch_all(pool)
    .await?;

    if !due.is_empty() {
        sqlx::query("DELETE FROM reminders WHERE remind_at <= datetime('now')")
            .execute(pool)
            .await?;
    }

    Ok(due)
}

/// Insert a new temporary punishment (ban or mute with expiry).
pub async fn add_temp_punishment(
    pool: &SqlitePool,
    guild_id: &str,
    user_id: &str,
    punishment_type: &str,
    expires_at: &str,
) -> AppResult<TempPunishment> {
    sqlx::query(
        "INSERT INTO temp_punishments (guild_id, user_id, punishment_type, expires_at) \
         VALUES (?, ?, ?, ?)",
    )
    .bind(guild_id)
    .bind(user_id)
    .bind(punishment_type)
    .bind(expires_at)
    .execute(pool)
    .await?;

    let punishment = sqlx::query_as::<_, TempPunishment>(
        "SELECT id, guild_id, user_id, punishment_type, expires_at, created_at \
         FROM temp_punishments WHERE id = last_insert_rowid()",
    )
    .fetch_one(pool)
    .await?;

    Ok(punishment)
}

/// Insert a new reminder.
pub async fn add_reminder(
    pool: &SqlitePool,
    user_id: &str,
    guild_id: &str,
    channel_id: &str,
    message: &str,
    remind_at: &str,
) -> AppResult<Reminder> {
    sqlx::query(
        "INSERT INTO reminders (user_id, guild_id, channel_id, message, remind_at) \
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(user_id)
    .bind(guild_id)
    .bind(channel_id)
    .bind(message)
    .bind(remind_at)
    .execute(pool)
    .await?;

    let reminder = sqlx::query_as::<_, Reminder>(
        "SELECT id, user_id, guild_id, channel_id, message, remind_at, created_at \
         FROM reminders WHERE id = last_insert_rowid()",
    )
    .fetch_one(pool)
    .await?;

    Ok(reminder)
}
