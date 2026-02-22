/// Row from the `reaction_roles` table.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct ReactionRole {
    pub id: i64,
    pub guild_id: String,
    pub channel_id: String,
    pub message_id: String,
    pub role_id: String,
    pub emoji: String,
    pub label: Option<String>,
    /// Button style: "primary", "secondary", "success", "danger".
    pub style: String,
    pub created_at: String,
}

/// Payload for creating a new reaction role entry.
#[derive(Debug, serde::Deserialize)]
pub struct CreateReactionRole {
    pub guild_id: String,
    pub channel_id: String,
    pub message_id: String,
    pub role_id: String,
    pub emoji: String,
    pub label: Option<String>,
    pub style: Option<String>,
}
