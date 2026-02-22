/// Row from the `transcripts` table.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct Transcript {
    /// UUID (TEXT primary key).
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
    /// Full HTML transcript body.
    pub html: String,
    pub created_at: String,
}

/// Payload for creating a new transcript.
#[derive(Debug, serde::Deserialize)]
pub struct CreateTranscript {
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
    pub html: String,
}
