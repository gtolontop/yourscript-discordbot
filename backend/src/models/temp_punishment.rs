/// Row from the `temp_punishments` table.
/// Represents a temporary ban or mute that should be lifted at `expires_at`.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct TempPunishment {
    pub id: i64,
    pub guild_id: String,
    pub user_id: String,
    /// "ban" or "mute".
    pub punishment_type: String,
    /// ISO-8601 timestamp when the punishment expires.
    pub expires_at: String,
    pub created_at: String,
}

/// Payload for creating a new temporary punishment.
#[derive(Debug, serde::Deserialize)]
pub struct CreateTempPunishment {
    pub guild_id: String,
    pub user_id: String,
    pub punishment_type: String,
    pub expires_at: String,
}
