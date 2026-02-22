/// Row from the `sessions` table (OAuth2 sessions for the web dashboard).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct Session {
    /// Opaque session token (TEXT primary key).
    pub id: String,
    pub user_id: String,
    pub access_token: String,
    pub username: String,
    pub avatar: Option<String>,
    /// ISO-8601 timestamp when the session expires.
    pub expires_at: String,
    pub created_at: String,
}

/// Payload for creating a new session.
#[derive(Debug, serde::Deserialize)]
pub struct CreateSession {
    pub id: String,
    pub user_id: String,
    pub access_token: String,
    pub username: String,
    pub avatar: Option<String>,
    pub expires_at: String,
}
