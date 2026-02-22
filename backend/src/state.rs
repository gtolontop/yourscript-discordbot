use sqlx::SqlitePool;
use std::sync::Arc;
use tokio::sync::broadcast;

use crate::config::Config;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(tag = "type")]
pub enum WsEvent {
    Stats {
        guild_id: String,
        data: serde_json::Value,
    },
    TicketUpdate {
        guild_id: String,
        ticket_id: i64,
        status: String,
    },
    DashboardLog {
        guild_id: String,
        action: String,
        user_id: String,
        details: String,
    },
}

pub struct AppStateInner {
    pub db: SqlitePool,
    pub config: Config,
    pub http: reqwest::Client,
    pub ws_tx: broadcast::Sender<WsEvent>,
}

pub type AppState = Arc<AppStateInner>;

impl AppStateInner {
    pub fn new(db: SqlitePool, config: Config) -> AppState {
        let (ws_tx, _) = broadcast::channel(256);
        Arc::new(Self {
            db,
            config,
            http: reqwest::Client::new(),
            ws_tx,
        })
    }
}
