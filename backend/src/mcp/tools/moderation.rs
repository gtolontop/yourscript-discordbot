use serde_json::Value;
use sqlx::SqlitePool;

use crate::models::warn::Warn;

pub async fn get_warns(db: &SqlitePool, args: &Value) -> Result<Value, String> {
    let guild_id = args["guild_id"].as_str().ok_or("guild_id required")?;
    let user_id = args["user_id"].as_str().ok_or("user_id required")?;

    let warns = sqlx::query_as::<_, Warn>(
        "SELECT * FROM warns WHERE guild_id = ? AND target_user_id = ? ORDER BY created_at DESC",
    )
    .bind(guild_id)
    .bind(user_id)
    .fetch_all(db)
    .await
    .map_err(|e| e.to_string())?;

    serde_json::to_value(&warns).map_err(|e| e.to_string())
}

pub async fn get_user_info(db: &SqlitePool, args: &Value) -> Result<Value, String> {
    let user_id = args["user_id"].as_str().ok_or("user_id required")?;

    let user = sqlx::query_as::<_, crate::models::user::User>(
        "SELECT * FROM users WHERE id = ?",
    )
    .bind(user_id)
    .fetch_optional(db)
    .await
    .map_err(|e| e.to_string())?;

    let warn_count = if let Some(guild_id) = args["guild_id"].as_str() {
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM warns WHERE target_user_id = ? AND guild_id = ?",
        )
        .bind(user_id)
        .bind(guild_id)
        .fetch_one(db)
        .await
        .unwrap_or(0)
    } else {
        0
    };

    Ok(serde_json::json!({
        "user": user,
        "warn_count": warn_count
    }))
}
