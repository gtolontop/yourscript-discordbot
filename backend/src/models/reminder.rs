/// Row from the `reminders` table.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct Reminder {
    pub id: i64,
    pub user_id: String,
    pub guild_id: String,
    pub channel_id: String,
    pub message: String,
    /// ISO-8601 timestamp when the reminder should fire.
    pub remind_at: String,
    pub created_at: String,
}

/// Payload for creating a new reminder.
#[derive(Debug, serde::Deserialize)]
pub struct CreateReminder {
    pub user_id: String,
    pub guild_id: String,
    pub channel_id: String,
    pub message: String,
    pub remind_at: String,
}
