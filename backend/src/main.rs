mod auth;
mod config;
mod db;
mod error;
mod mcp;
mod models;
mod routes;
mod services;
mod state;
mod ws;

use crate::config::Config;
use crate::db::pool::create_pool;
use crate::state::AppStateInner;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load .env from project root
    dotenvy::from_path("../.env").ok();
    dotenvy::dotenv().ok();

    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "backend=info,tower_http=info".into()),
        )
        .init();

    let config = Config::from_env();
    tracing::info!("Starting backend server on port {}", config.web_port);

    // Create database pool and run migrations
    let db = create_pool(&config.database_url).await?;
    tracing::info!("Database connected and migrations applied");

    // Create app state
    let web_port = config.web_port;
    let mcp_port = config.mcp_port;
    let state = AppStateInner::new(db, config);

    // Start MCP server in background
    let mcp_state = state.clone();
    tokio::spawn(async move {
        mcp::server::start_mcp_server(mcp_state, mcp_port).await;
    });

    // Start scheduler in background
    let scheduler_state = state.clone();
    tokio::spawn(async move {
        services::scheduler::run_scheduler(&scheduler_state.db).await;
    });

    // Build router
    let app = routes::build_router(state);

    // Start web server
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{web_port}")).await?;
    tracing::info!("Backend listening on 0.0.0.0:{web_port}");
    axum::serve(listener, app).await?;

    Ok(())
}
