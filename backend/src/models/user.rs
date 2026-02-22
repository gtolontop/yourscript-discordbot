/// Row from the `users` table.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct User {
    /// Discord user ID.
    pub id: String,
    pub xp: i64,
    pub level: i64,
    pub balance: i64,
    /// ISO-8601 timestamp of the last `/daily` claim.
    pub last_daily: Option<String>,
    /// 0 = hidden, 1 = visible.
    pub visible_xp: i64,
    pub created_at: String,
    pub updated_at: String,
}

/// Payload for creating a new user row. Only the `id` is mandatory.
#[derive(Debug, serde::Deserialize)]
pub struct CreateUser {
    pub id: String,
}

/// Partial-update payload for a user.
#[derive(Debug, serde::Deserialize)]
pub struct UpdateUser {
    pub xp: Option<i64>,
    pub level: Option<i64>,
    pub balance: Option<i64>,
    pub last_daily: Option<Option<String>>,
    pub visible_xp: Option<i64>,
}
