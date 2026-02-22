use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub web_port: u16,
    pub web_url: String,
    pub session_secret: String,
    pub discord_token: String,
    pub client_id: String,
    pub client_secret: String,
    pub bot_api_key: String,
    pub mcp_port: u16,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            database_url: env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:data.db".into()),
            web_port: env::var("WEB_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(3000),
            web_url: env::var("WEB_URL").unwrap_or_else(|_| "http://localhost:3000".into()),
            session_secret: env::var("SESSION_SECRET")
                .unwrap_or_else(|_| "change-me-in-production".into()),
            discord_token: env::var("DISCORD_TOKEN").expect("DISCORD_TOKEN required"),
            client_id: env::var("CLIENT_ID").expect("CLIENT_ID required"),
            client_secret: env::var("CLIENT_SECRET").expect("CLIENT_SECRET required"),
            bot_api_key: env::var("BOT_API_KEY").unwrap_or_else(|_| {
                uuid::Uuid::new_v4().to_string()
            }),
            mcp_port: env::var("MCP_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(3001),
        }
    }
}
