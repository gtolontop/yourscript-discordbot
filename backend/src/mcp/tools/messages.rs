use serde_json::Value;
use sqlx::SqlitePool;

pub async fn search(_db: &SqlitePool, args: &Value) -> Result<Value, String> {
    // Message search requires the Discord bot to relay messages
    // The MCP server returns an instruction for the bot to execute
    let channel_id = args["channel_id"].as_str().ok_or("channel_id required")?;
    let query = args["query"].as_str().unwrap_or("");

    Ok(serde_json::json!({
        "status": "requires_bot",
        "action": "search_messages",
        "channel_id": channel_id,
        "query": query,
        "note": "This tool requires the Discord bot to fetch messages from the channel. The bot will relay the results."
    }))
}
