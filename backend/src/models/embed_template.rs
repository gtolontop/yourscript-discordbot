/// Row from the `embed_templates` table.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct EmbedTemplate {
    pub id: i64,
    pub guild_id: String,
    pub name: String,
    /// JSON-encoded embed object.
    pub embed: String,
    pub created_at: String,
}

/// Payload for creating a new embed template.
#[derive(Debug, serde::Deserialize)]
pub struct CreateEmbedTemplate {
    pub guild_id: String,
    pub name: String,
    /// JSON-encoded embed object.
    pub embed: String,
}

/// Partial-update payload for an embed template.
#[derive(Debug, serde::Deserialize)]
pub struct UpdateEmbedTemplate {
    pub name: Option<String>,
    pub embed: Option<String>,
}
