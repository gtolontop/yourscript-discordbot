use serde_json::Value;
use sqlx::SqlitePool;

use crate::models::ticket::Ticket;

pub async fn list(db: &SqlitePool, args: &Value) -> Result<Value, String> {
    let guild_id = args["guild_id"].as_str().ok_or("guild_id required")?;
    let status = args["status"].as_str().unwrap_or("open");

    let tickets = sqlx::query_as::<_, Ticket>(
        "SELECT * FROM tickets WHERE guild_id = ? AND status = ? ORDER BY created_at DESC LIMIT 50",
    )
    .bind(guild_id)
    .bind(status)
    .fetch_all(db)
    .await
    .map_err(|e| e.to_string())?;

    serde_json::to_value(&tickets).map_err(|e| e.to_string())
}

pub async fn get(db: &SqlitePool, args: &Value) -> Result<Value, String> {
    let ticket_id = args["ticket_id"].as_i64().ok_or("ticket_id required")?;

    let ticket = sqlx::query_as::<_, Ticket>("SELECT * FROM tickets WHERE id = ?")
        .bind(ticket_id)
        .fetch_optional(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Ticket not found")?;

    serde_json::to_value(&ticket).map_err(|e| e.to_string())
}

pub async fn close(db: &SqlitePool, args: &Value) -> Result<Value, String> {
    let ticket_id = args["ticket_id"].as_i64().ok_or("ticket_id required")?;
    let closed_by = args["closed_by"].as_str().ok_or("closed_by required")?;

    sqlx::query(
        "UPDATE tickets SET status = 'closed', closed_by = ?, closed_at = datetime('now') WHERE id = ? AND status = 'open'",
    )
    .bind(closed_by)
    .bind(ticket_id)
    .execute(db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({ "status": "closed", "ticket_id": ticket_id }))
}
