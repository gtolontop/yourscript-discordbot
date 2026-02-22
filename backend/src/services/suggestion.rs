use sqlx::SqlitePool;

use crate::error::{AppError, AppResult};
use crate::models::Suggestion;

/// Create a new suggestion.
pub async fn create(
    pool: &SqlitePool,
    guild_id: &str,
    user_id: &str,
    message_id: &str,
    content: &str,
) -> AppResult<Suggestion> {
    sqlx::query(
        "INSERT INTO suggestions (guild_id, user_id, message_id, content) \
         VALUES (?, ?, ?, ?)",
    )
    .bind(guild_id)
    .bind(user_id)
    .bind(message_id)
    .bind(content)
    .execute(pool)
    .await?;

    let suggestion = sqlx::query_as::<_, Suggestion>(
        "SELECT id, guild_id, user_id, message_id, content, status, \
         staff_id, staff_reason, upvotes, downvotes, created_at \
         FROM suggestions WHERE id = last_insert_rowid()",
    )
    .fetch_one(pool)
    .await?;

    Ok(suggestion)
}

/// List suggestions for a guild, optionally filtered by status.
pub async fn list(
    pool: &SqlitePool,
    guild_id: &str,
    status: Option<&str>,
) -> AppResult<Vec<Suggestion>> {
    let suggestions = if let Some(s) = status {
        sqlx::query_as::<_, Suggestion>(
            "SELECT id, guild_id, user_id, message_id, content, status, \
             staff_id, staff_reason, upvotes, downvotes, created_at \
             FROM suggestions WHERE guild_id = ? AND status = ? \
             ORDER BY created_at DESC",
        )
        .bind(guild_id)
        .bind(s)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as::<_, Suggestion>(
            "SELECT id, guild_id, user_id, message_id, content, status, \
             staff_id, staff_reason, upvotes, downvotes, created_at \
             FROM suggestions WHERE guild_id = ? ORDER BY created_at DESC",
        )
        .bind(guild_id)
        .fetch_all(pool)
        .await?
    };

    Ok(suggestions)
}

/// Fetch a single suggestion by ID.
pub async fn get(pool: &SqlitePool, suggestion_id: i64) -> AppResult<Suggestion> {
    let suggestion = sqlx::query_as::<_, Suggestion>(
        "SELECT id, guild_id, user_id, message_id, content, status, \
         staff_id, staff_reason, upvotes, downvotes, created_at \
         FROM suggestions WHERE id = ?",
    )
    .bind(suggestion_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Suggestion {suggestion_id} not found")))?;

    Ok(suggestion)
}

/// Record a vote on a suggestion.
///
/// * `vote` - `"up"` to increment upvotes, `"down"` to increment downvotes.
///
/// In a real-world scenario you would also track *who* voted to prevent
/// duplicate votes; that is handled on the Discord side by tracking button
/// interactions.
pub async fn vote(
    pool: &SqlitePool,
    suggestion_id: i64,
    vote: &str,
) -> AppResult<Suggestion> {
    let column = match vote {
        "up" => "upvotes",
        "down" => "downvotes",
        _ => {
            return Err(AppError::BadRequest(
                "Vote must be 'up' or 'down'".into(),
            ))
        }
    };

    // We build the query with the validated column name.
    let sql = format!(
        "UPDATE suggestions SET {column} = {column} + 1 WHERE id = ?",
    );

    let result = sqlx::query(&sql)
        .bind(suggestion_id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!(
            "Suggestion {suggestion_id} not found"
        )));
    }

    get(pool, suggestion_id).await
}

/// Approve a suggestion. Sets the status to `approved` and records which
/// staff member approved it and an optional reason.
pub async fn approve(
    pool: &SqlitePool,
    suggestion_id: i64,
    staff_id: &str,
    reason: Option<&str>,
) -> AppResult<Suggestion> {
    let result = sqlx::query(
        "UPDATE suggestions SET status = 'approved', staff_id = ?, staff_reason = ? WHERE id = ?",
    )
    .bind(staff_id)
    .bind(reason)
    .bind(suggestion_id)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!(
            "Suggestion {suggestion_id} not found"
        )));
    }

    get(pool, suggestion_id).await
}

/// Reject a suggestion. Sets the status to `rejected` and records which
/// staff member rejected it and an optional reason.
pub async fn reject(
    pool: &SqlitePool,
    suggestion_id: i64,
    staff_id: &str,
    reason: Option<&str>,
) -> AppResult<Suggestion> {
    let result = sqlx::query(
        "UPDATE suggestions SET status = 'rejected', staff_id = ?, staff_reason = ? WHERE id = ?",
    )
    .bind(staff_id)
    .bind(reason)
    .bind(suggestion_id)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!(
            "Suggestion {suggestion_id} not found"
        )));
    }

    get(pool, suggestion_id).await
}
