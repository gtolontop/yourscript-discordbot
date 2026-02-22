use sqlx::SqlitePool;

use crate::error::{AppError, AppResult};
use crate::models::{CreateWarn, Warn};

/// Insert a new warning and return the created row.
pub async fn add_warn(pool: &SqlitePool, data: CreateWarn) -> AppResult<Warn> {
    sqlx::query(
        "INSERT INTO warns (target_user_id, moderator_id, reason, guild_id) VALUES (?, ?, ?, ?)",
    )
    .bind(&data.target_user_id)
    .bind(&data.moderator_id)
    .bind(&data.reason)
    .bind(&data.guild_id)
    .execute(pool)
    .await?;

    // Fetch the row we just inserted (last_insert_rowid).
    let warn = sqlx::query_as::<_, Warn>(
        "SELECT id, target_user_id, moderator_id, reason, guild_id, created_at \
         FROM warns WHERE id = last_insert_rowid()",
    )
    .fetch_one(pool)
    .await?;

    Ok(warn)
}

/// List all warnings for a given user in a guild.
pub async fn get_warns(
    pool: &SqlitePool,
    guild_id: &str,
    target_user_id: &str,
) -> AppResult<Vec<Warn>> {
    let warns = sqlx::query_as::<_, Warn>(
        "SELECT id, target_user_id, moderator_id, reason, guild_id, created_at \
         FROM warns WHERE guild_id = ? AND target_user_id = ? ORDER BY created_at DESC",
    )
    .bind(guild_id)
    .bind(target_user_id)
    .fetch_all(pool)
    .await?;

    Ok(warns)
}

/// Delete a single warning by its ID (scoped to a guild).
pub async fn delete_warn(pool: &SqlitePool, guild_id: &str, warn_id: i64) -> AppResult<()> {
    let result = sqlx::query("DELETE FROM warns WHERE id = ? AND guild_id = ?")
        .bind(warn_id)
        .bind(guild_id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Warn {warn_id} not found")));
    }

    Ok(())
}

/// Delete all warnings for a user in a guild. Returns the number deleted.
pub async fn clear_warns(
    pool: &SqlitePool,
    guild_id: &str,
    target_user_id: &str,
) -> AppResult<u64> {
    let result =
        sqlx::query("DELETE FROM warns WHERE guild_id = ? AND target_user_id = ?")
            .bind(guild_id)
            .bind(target_user_id)
            .execute(pool)
            .await?;

    Ok(result.rows_affected())
}

/// Return the total number of warnings for a user in a guild.
pub async fn get_warn_count(
    pool: &SqlitePool,
    guild_id: &str,
    target_user_id: &str,
) -> AppResult<i64> {
    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM warns WHERE guild_id = ? AND target_user_id = ?",
    )
    .bind(guild_id)
    .bind(target_user_id)
    .fetch_one(pool)
    .await?;

    Ok(row.0)
}
