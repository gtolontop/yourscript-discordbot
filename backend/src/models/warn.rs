/// Row from the `warns` table.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct Warn {
    pub id: i64,
    pub target_user_id: String,
    pub moderator_id: String,
    pub reason: String,
    pub guild_id: String,
    pub created_at: String,
}

/// Payload for issuing a new warning.
#[derive(Debug, serde::Deserialize)]
pub struct CreateWarn {
    pub target_user_id: String,
    pub moderator_id: String,
    pub reason: String,
    pub guild_id: String,
}
