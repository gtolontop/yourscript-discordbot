pub mod auth;
pub mod auto_roles;
pub mod bot_actions;
pub mod config;
pub mod embeds;
pub mod giveaways;
pub mod guilds;
pub mod leaderboard;
pub mod logs;
pub mod moderation;
pub mod reaction_roles;
pub mod suggestions;
pub mod tickets;
pub mod transcripts;

use axum::{routing::get, Router};
use tower_http::services::{ServeDir, ServeFile};

use crate::state::AppState;

/// Build the top-level router with all sub-routers nested.
pub fn build_router(state: AppState) -> Router {
    let dashboard_dir = std::path::PathBuf::from("../dashboard/dist");
    let index_file = dashboard_dir.join("index.html");

    // API v1 routes
    let api = Router::new()
        .nest("/auth", auth::router())
        .nest("/guilds", guilds::router())
        .nest("/guilds", tickets::router())
        .nest("/guilds", moderation::router())
        .nest("/guilds", giveaways::router())
        .nest("/guilds", suggestions::router())
        .nest("/guilds", reaction_roles::router())
        .nest("/guilds", auto_roles::router())
        .nest("/guilds", embeds::router())
        .nest("/guilds", leaderboard::router())
        .nest("/guilds", transcripts::guild_router())
        .nest("/guilds", logs::router())
        .nest("/guilds", config::router())
        .nest("/bot", bot_actions::router());

    let app = Router::new()
        .nest("/api/v1", api)
        // Public transcript view (requires auth via query or cookie)
        .route("/transcript/{id}", get(transcripts::view_transcript))
        .with_state(state);

    // Serve SPA static files as fallback
    if dashboard_dir.exists() {
        app.fallback_service(
            ServeDir::new(&dashboard_dir)
                .not_found_service(ServeFile::new(&index_file)),
        )
    } else {
        app
    }
}
