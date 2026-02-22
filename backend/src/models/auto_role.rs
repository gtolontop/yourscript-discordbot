/// Row from the `auto_roles` table.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct AutoRole {
    pub id: i64,
    pub guild_id: String,
    pub role_id: String,
    /// "join" or "bot".
    pub role_type: String,
    /// Delay in seconds before applying the role.
    pub delay: i64,
    pub created_at: String,
}

/// Payload for creating a new auto-role rule.
#[derive(Debug, serde::Deserialize)]
pub struct CreateAutoRole {
    pub guild_id: String,
    pub role_id: String,
    pub role_type: Option<String>,
    pub delay: Option<i64>,
}
