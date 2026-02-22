/// Row from the `suggestions` table.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct Suggestion {
    pub id: i64,
    pub guild_id: String,
    pub user_id: String,
    pub message_id: String,
    pub content: String,
    /// "pending", "approved", or "rejected".
    pub status: String,
    pub staff_id: Option<String>,
    pub staff_reason: Option<String>,
    pub upvotes: i64,
    pub downvotes: i64,
    pub created_at: String,
}

/// Payload for creating a new suggestion.
#[derive(Debug, serde::Deserialize)]
pub struct CreateSuggestion {
    pub guild_id: String,
    pub user_id: String,
    pub message_id: String,
    pub content: String,
}

/// Partial-update payload for a suggestion.
#[derive(Debug, serde::Deserialize)]
pub struct UpdateSuggestion {
    pub status: Option<String>,
    pub staff_id: Option<Option<String>>,
    pub staff_reason: Option<Option<String>>,
    pub upvotes: Option<i64>,
    pub downvotes: Option<i64>,
}
