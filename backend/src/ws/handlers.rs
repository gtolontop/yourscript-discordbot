use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
};
use futures::{SinkExt, StreamExt};
use tokio::sync::broadcast;

use crate::state::{AppState, WsEvent};

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: AppState) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = state.ws_tx.subscribe();

    // Track which guilds this connection is subscribed to
    let subscribed_guilds = std::sync::Arc::new(tokio::sync::Mutex::new(Vec::<String>::new()));
    let guilds_for_broadcast = subscribed_guilds.clone();

    // Forward broadcast events to this WebSocket client
    let mut send_task = tokio::spawn(async move {
        while let Ok(event) = rx.recv().await {
            let guild_id = match &event {
                WsEvent::Stats { guild_id, .. } => guild_id,
                WsEvent::TicketUpdate { guild_id, .. } => guild_id,
                WsEvent::DashboardLog { guild_id, .. } => guild_id,
            };

            let guilds = guilds_for_broadcast.lock().await;
            if guilds.contains(guild_id) {
                if let Ok(json) = serde_json::to_string(&event) {
                    if sender.send(Message::Text(json.into())).await.is_err() {
                        break;
                    }
                }
            }
        }
    });

    // Handle incoming messages (subscribe/unsubscribe)
    let guilds_for_recv = subscribed_guilds.clone();
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Text(text) => {
                    if let Ok(cmd) = serde_json::from_str::<WsCommand>(&text) {
                        let mut guilds = guilds_for_recv.lock().await;
                        match cmd {
                            WsCommand::Subscribe { guild_id } => {
                                if !guilds.contains(&guild_id) {
                                    guilds.push(guild_id);
                                }
                            }
                            WsCommand::Unsubscribe { guild_id } => {
                                guilds.retain(|g| g != &guild_id);
                            }
                        }
                    }
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
    });

    // Wait for either task to finish
    tokio::select! {
        _ = &mut send_task => recv_task.abort(),
        _ = &mut recv_task => send_task.abort(),
    }
}

#[derive(serde::Deserialize)]
#[serde(tag = "type")]
enum WsCommand {
    #[serde(rename = "subscribe")]
    Subscribe { guild_id: String },
    #[serde(rename = "unsubscribe")]
    Unsubscribe { guild_id: String },
}
