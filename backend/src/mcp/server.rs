use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::tools;
use crate::state::AppState;

/// MCP Protocol types
#[derive(Debug, Serialize, Deserialize)]
pub struct McpRequest {
    pub jsonrpc: String,
    pub id: Option<Value>,
    pub method: String,
    #[serde(default)]
    pub params: Value,
}

#[derive(Debug, Serialize)]
pub struct McpResponse {
    pub jsonrpc: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<McpError>,
}

#[derive(Debug, Serialize)]
pub struct McpError {
    pub code: i64,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub input_schema: Value,
}

impl McpResponse {
    pub fn success(id: Option<Value>, result: Value) -> Self {
        Self {
            jsonrpc: "2.0".into(),
            id,
            result: Some(result),
            error: None,
        }
    }

    pub fn error(id: Option<Value>, code: i64, message: String) -> Self {
        Self {
            jsonrpc: "2.0".into(),
            id,
            result: None,
            error: Some(McpError { code, message }),
        }
    }
}

/// MCP Server that handles JSON-RPC requests
pub struct McpServer {
    state: AppState,
}

impl McpServer {
    pub fn new(state: AppState) -> Self {
        Self { state }
    }

    pub async fn handle_request(&self, request: McpRequest) -> McpResponse {
        match request.method.as_str() {
            "initialize" => self.handle_initialize(request.id),
            "tools/list" => self.handle_tools_list(request.id),
            "tools/call" => self.handle_tool_call(request.id, request.params).await,
            _ => McpResponse::error(request.id, -32601, "Method not found".into()),
        }
    }

    fn handle_initialize(&self, id: Option<Value>) -> McpResponse {
        McpResponse::success(
            id,
            serde_json::json!({
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {}
                },
                "serverInfo": {
                    "name": "discord-bot-mcp",
                    "version": "1.0.0"
                }
            }),
        )
    }

    fn handle_tools_list(&self, id: Option<Value>) -> McpResponse {
        let tools = self.get_tool_definitions();
        McpResponse::success(id, serde_json::json!({ "tools": tools }))
    }

    async fn handle_tool_call(&self, id: Option<Value>, params: Value) -> McpResponse {
        let name = params["name"].as_str().unwrap_or("");
        let arguments = &params["arguments"];

        let result = match name {
            "tickets.list" => tools::tickets::list(&self.state.db, arguments).await,
            "tickets.get" => tools::tickets::get(&self.state.db, arguments).await,
            "tickets.close" => tools::tickets::close(&self.state.db, arguments).await,
            "moderation.get_warns" => tools::moderation::get_warns(&self.state.db, arguments).await,
            "moderation.get_user_info" => {
                tools::moderation::get_user_info(&self.state.db, arguments).await
            }
            "messages.search" => tools::messages::search(&self.state.db, arguments).await,
            "guild.config" => tools::config::get_config(&self.state.db, arguments).await,
            "actions.send_message" => {
                // This needs to go through the bot - return instruction
                Ok(serde_json::json!({
                    "status": "requires_bot",
                    "action": "send_message",
                    "params": arguments
                }))
            }
            _ => Err(format!("Unknown tool: {name}")),
        };

        match result {
            Ok(content) => McpResponse::success(
                id,
                serde_json::json!({
                    "content": [{
                        "type": "text",
                        "text": serde_json::to_string_pretty(&content).unwrap_or_default()
                    }]
                }),
            ),
            Err(e) => McpResponse::success(
                id,
                serde_json::json!({
                    "content": [{
                        "type": "text",
                        "text": format!("Error: {e}")
                    }],
                    "isError": true
                }),
            ),
        }
    }

    fn get_tool_definitions(&self) -> Vec<ToolDefinition> {
        vec![
            ToolDefinition {
                name: "tickets.list".into(),
                description: "List open tickets for a guild".into(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "guild_id": { "type": "string", "description": "Discord guild ID" },
                        "status": { "type": "string", "enum": ["open", "closed", "review"], "description": "Filter by status" }
                    },
                    "required": ["guild_id"]
                }),
            },
            ToolDefinition {
                name: "tickets.get".into(),
                description: "Get details of a specific ticket".into(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "ticket_id": { "type": "integer", "description": "Ticket ID" }
                    },
                    "required": ["ticket_id"]
                }),
            },
            ToolDefinition {
                name: "tickets.close".into(),
                description: "Close a ticket".into(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "ticket_id": { "type": "integer", "description": "Ticket ID" },
                        "closed_by": { "type": "string", "description": "User ID who closes the ticket" }
                    },
                    "required": ["ticket_id", "closed_by"]
                }),
            },
            ToolDefinition {
                name: "moderation.get_warns".into(),
                description: "Get warnings for a user in a guild".into(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "guild_id": { "type": "string" },
                        "user_id": { "type": "string" }
                    },
                    "required": ["guild_id", "user_id"]
                }),
            },
            ToolDefinition {
                name: "moderation.get_user_info".into(),
                description: "Get user profile info (XP, level, balance, warns)".into(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "user_id": { "type": "string" },
                        "guild_id": { "type": "string" }
                    },
                    "required": ["user_id"]
                }),
            },
            ToolDefinition {
                name: "messages.search".into(),
                description: "Search messages (requires bot relay)".into(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "channel_id": { "type": "string" },
                        "query": { "type": "string" }
                    },
                    "required": ["channel_id"]
                }),
            },
            ToolDefinition {
                name: "guild.config".into(),
                description: "Get guild configuration".into(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "guild_id": { "type": "string" }
                    },
                    "required": ["guild_id"]
                }),
            },
            ToolDefinition {
                name: "actions.send_message".into(),
                description: "Send a message to a Discord channel (requires bot relay)".into(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "channel_id": { "type": "string" },
                        "content": { "type": "string" }
                    },
                    "required": ["channel_id", "content"]
                }),
            },
        ]
    }
}

/// Start MCP server on a TCP port (JSON-RPC over newline-delimited JSON)
pub async fn start_mcp_server(state: AppState, port: u16) {
    use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
    use tokio::net::TcpListener;

    let listener = match TcpListener::bind(format!("127.0.0.1:{port}")).await {
        Ok(l) => l,
        Err(e) => {
            tracing::error!("Failed to start MCP server on port {port}: {e}");
            return;
        }
    };

    tracing::info!("MCP server listening on 127.0.0.1:{port}");

    loop {
        let (stream, addr) = match listener.accept().await {
            Ok(conn) => conn,
            Err(e) => {
                tracing::error!("MCP accept error: {e}");
                continue;
            }
        };

        tracing::info!("MCP client connected from {addr}");
        let server = McpServer::new(state.clone());

        tokio::spawn(async move {
            let (reader, mut writer) = stream.into_split();
            let mut lines = BufReader::new(reader).lines();

            while let Ok(Some(line)) = lines.next_line().await {
                let line = line.trim().to_string();
                if line.is_empty() {
                    continue;
                }

                let response = match serde_json::from_str::<McpRequest>(&line) {
                    Ok(request) => server.handle_request(request).await,
                    Err(e) => McpResponse::error(None, -32700, format!("Parse error: {e}")),
                };

                let mut json = serde_json::to_string(&response).unwrap_or_default();
                json.push('\n');

                if writer.write_all(json.as_bytes()).await.is_err() {
                    break;
                }
            }

            tracing::info!("MCP client disconnected from {addr}");
        });
    }
}
