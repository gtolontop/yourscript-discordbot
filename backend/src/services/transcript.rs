use sqlx::SqlitePool;

use crate::error::{AppError, AppResult};
use crate::models::Transcript;

/// Save a transcript for a closed ticket.
///
/// The caller must supply a unique UUID `id`.
pub async fn save_transcript(
    pool: &SqlitePool,
    id: &str,
    ticket_id: i64,
    ticket_number: i64,
    guild_id: &str,
    guild_name: &str,
    user_id: &str,
    user_name: &str,
    closed_by: &str,
    closed_by_name: &str,
    subject: Option<&str>,
    category: Option<&str>,
    message_count: i64,
    html: &str,
) -> AppResult<Transcript> {
    sqlx::query(
        "INSERT INTO transcripts \
         (id, ticket_id, ticket_number, guild_id, guild_name, user_id, user_name, \
          closed_by, closed_by_name, subject, category, message_count, html) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(id)
    .bind(ticket_id)
    .bind(ticket_number)
    .bind(guild_id)
    .bind(guild_name)
    .bind(user_id)
    .bind(user_name)
    .bind(closed_by)
    .bind(closed_by_name)
    .bind(subject)
    .bind(category)
    .bind(message_count)
    .bind(html)
    .execute(pool)
    .await?;

    let transcript = sqlx::query_as::<_, Transcript>(
        "SELECT id, ticket_id, ticket_number, guild_id, guild_name, user_id, user_name, \
         closed_by, closed_by_name, subject, category, message_count, html, created_at \
         FROM transcripts WHERE id = ?",
    )
    .bind(id)
    .fetch_one(pool)
    .await?;

    Ok(transcript)
}

/// Fetch a single transcript by its UUID.
pub async fn get_transcript(pool: &SqlitePool, transcript_id: &str) -> AppResult<Transcript> {
    let transcript = sqlx::query_as::<_, Transcript>(
        "SELECT id, ticket_id, ticket_number, guild_id, guild_name, user_id, user_name, \
         closed_by, closed_by_name, subject, category, message_count, html, created_at \
         FROM transcripts WHERE id = ?",
    )
    .bind(transcript_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Transcript {transcript_id} not found")))?;

    Ok(transcript)
}

/// List all transcripts for a given user, optionally scoped to a guild.
///
/// Results are ordered newest-first.
pub async fn list_user_transcripts(
    pool: &SqlitePool,
    user_id: &str,
    guild_id: Option<&str>,
) -> AppResult<Vec<Transcript>> {
    let transcripts = if let Some(gid) = guild_id {
        sqlx::query_as::<_, Transcript>(
            "SELECT id, ticket_id, ticket_number, guild_id, guild_name, user_id, user_name, \
             closed_by, closed_by_name, subject, category, message_count, html, created_at \
             FROM transcripts WHERE user_id = ? AND guild_id = ? \
             ORDER BY created_at DESC",
        )
        .bind(user_id)
        .bind(gid)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as::<_, Transcript>(
            "SELECT id, ticket_id, ticket_number, guild_id, guild_name, user_id, user_name, \
             closed_by, closed_by_name, subject, category, message_count, html, created_at \
             FROM transcripts WHERE user_id = ? \
             ORDER BY created_at DESC",
        )
        .bind(user_id)
        .fetch_all(pool)
        .await?
    };

    Ok(transcripts)
}
