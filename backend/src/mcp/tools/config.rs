use serde_json::Value;
use sqlx::SqlitePool;

use crate::models::guild::GuildConfig;

pub async fn get_config(db: &SqlitePool, args: &Value) -> Result<Value, String> {
    let guild_id = args["guild_id"].as_str().ok_or("guild_id required")?;

    let config = sqlx::query_as::<_, GuildConfig>("SELECT * FROM guilds WHERE id = ?")
        .bind(guild_id)
        .fetch_optional(db)
        .await
        .map_err(|e| e.to_string())?;

    match config {
        Some(c) => serde_json::to_value(&c).map_err(|e| e.to_string()),
        None => Ok(serde_json::json!({ "error": "Guild not configured" })),
    }
}
