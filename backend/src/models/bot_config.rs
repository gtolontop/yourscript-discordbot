/// Row from the `bot_config` singleton table.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct BotConfig {
    /// Always "bot".
    pub id: String,
    pub status_type: Option<String>,
    pub status_text: Option<String>,
    pub status_url: Option<String>,
    pub updated_at: String,
}

/// Partial-update payload for the bot configuration.
#[derive(Debug, serde::Deserialize)]
pub struct UpdateBotConfig {
    pub status_type: Option<Option<String>>,
    pub status_text: Option<Option<String>>,
    pub status_url: Option<Option<String>>,
}
