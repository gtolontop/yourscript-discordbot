/// Row from the `giveaways` table.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct Giveaway {
    pub id: i64,
    pub guild_id: String,
    pub channel_id: String,
    pub message_id: String,
    pub host_id: String,
    pub prize: String,
    pub winners: i64,
    pub required_role: Option<String>,
    pub ends_at: String,
    /// 0 = running, 1 = ended.
    pub ended: i64,
    /// JSON array of winner user IDs.
    pub winner_ids: String,
    /// JSON array of participant user IDs.
    pub participants: String,
    pub created_at: String,
}

/// Payload for creating a new giveaway.
#[derive(Debug, serde::Deserialize)]
pub struct CreateGiveaway {
    pub guild_id: String,
    pub channel_id: String,
    pub message_id: String,
    pub host_id: String,
    pub prize: String,
    pub winners: i64,
    pub required_role: Option<String>,
    pub ends_at: String,
}

/// Partial-update payload for a giveaway.
#[derive(Debug, serde::Deserialize)]
pub struct UpdateGiveaway {
    pub ended: Option<i64>,
    pub winner_ids: Option<String>,
    pub participants: Option<String>,
}
