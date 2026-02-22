/// Row from the `dashboard_logs` table.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct DashboardLog {
    pub id: i64,
    pub guild_id: String,
    pub user_id: String,
    pub action: String,
    pub details: String,
    pub created_at: String,
}

/// Payload for creating a new dashboard log entry.
#[derive(Debug, serde::Deserialize)]
pub struct CreateDashboardLog {
    pub guild_id: String,
    pub user_id: String,
    pub action: String,
    pub details: String,
}
