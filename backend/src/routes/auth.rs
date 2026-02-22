use axum::{
    extract::{Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Redirect, Response},
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;

use crate::auth::discord_oauth;
use crate::auth::middleware::AuthUser;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/login", get(login))
        .route("/callback", get(callback))
        .route("/logout", get(logout))
        .route("/me", get(me))
}

// ── GET /login ──────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct LoginQuery {
    pub redirect: Option<String>,
}

async fn login(
    State(state): State<AppState>,
    Query(query): Query<LoginQuery>,
) -> Redirect {
    let redirect = query.redirect.as_deref().unwrap_or("/");
    let url = discord_oauth::get_oauth_url(&state.config, redirect);
    Redirect::temporary(&url)
}

// ── GET /callback ───────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct CallbackQuery {
    pub code: String,
    pub state: Option<String>,
}

async fn callback(
    State(state): State<AppState>,
    Query(query): Query<CallbackQuery>,
) -> AppResult<Response> {
    // Exchange the authorization code for an access token
    let token = discord_oauth::exchange_code(&state.http, &state.config, &query.code)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Discord token exchange failed: {e}")))?;

    // Fetch the authenticated Discord user
    let user = discord_oauth::get_user(&state.http, &token.access_token)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to fetch Discord user: {e}")))?;

    // Create a session
    let session_id = uuid::Uuid::new_v4().to_string();
    let expires_at = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::days(7))
        .unwrap_or_else(chrono::Utc::now)
        .format("%Y-%m-%d %H:%M:%S")
        .to_string();

    sqlx::query(
        "INSERT INTO sessions (id, user_id, access_token, username, avatar, expires_at) \
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&session_id)
    .bind(&user.id)
    .bind(&token.access_token)
    .bind(&user.username)
    .bind(&user.avatar)
    .bind(&expires_at)
    .execute(&state.db)
    .await?;

    // Determine the redirect path from the state parameter
    let redirect_path = query
        .state
        .as_deref()
        .and_then(|s| base64_decode(s).ok())
        .and_then(|json_str| serde_json::from_str::<serde_json::Value>(&json_str).ok())
        .and_then(|v| v.get("redirect")?.as_str().map(String::from))
        .unwrap_or_else(|| "/".to_string());

    // Build redirect response with session cookie
    let cookie = format!(
        "session_id={session_id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800"
    );

    let response = (
        StatusCode::FOUND,
        [
            (header::SET_COOKIE, cookie),
            (header::LOCATION, redirect_path),
        ],
    )
        .into_response();

    Ok(response)
}

// ── GET /logout ─────────────────────────────────────────────────────────────

async fn logout(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
) -> Response {
    // Try to extract session ID from cookie and delete it
    if let Some(cookie_header) = headers.get(header::COOKIE) {
        if let Ok(cookie_str) = cookie_header.to_str() {
            for cookie in cookie_str.split(';') {
                let cookie = cookie.trim();
                if let Some(session_id) = cookie.strip_prefix("session_id=") {
                    let _ = sqlx::query("DELETE FROM sessions WHERE id = ?")
                        .bind(session_id)
                        .execute(&state.db)
                        .await;
                }
            }
        }
    }

    // Clear the cookie and redirect to home
    let cookie = "session_id=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
    (
        StatusCode::FOUND,
        [
            (header::SET_COOKIE, cookie.to_string()),
            (header::LOCATION, "/".to_string()),
        ],
    )
        .into_response()
}

// ── GET /me ─────────────────────────────────────────────────────────────────

async fn me(user: AuthUser) -> Json<serde_json::Value> {
    Json(json!({
        "id": user.id,
        "username": user.username,
        "avatar": user.avatar,
    }))
}

// ── Helpers ─────────────────────────────────────────────────────────────────

fn base64_decode(input: &str) -> Result<String, String> {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    let input = input.trim_end_matches('=');
    let mut bytes = Vec::new();
    let mut buf: u32 = 0;
    let mut bits: u32 = 0;

    for &ch in input.as_bytes() {
        let val = CHARS.iter().position(|&c| c == ch).ok_or("Invalid base64")? as u32;
        buf = (buf << 6) | val;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            bytes.push((buf >> bits) as u8);
            buf &= (1 << bits) - 1;
        }
    }

    String::from_utf8(bytes).map_err(|e| e.to_string())
}

