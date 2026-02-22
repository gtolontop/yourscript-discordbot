use axum::{
    extract::{FromRequestParts, State},
    http::{header, request::Parts},
};
use sqlx::SqlitePool;

use crate::{error::AppError, state::AppState};

#[derive(Debug, Clone, serde::Serialize)]
pub struct AuthUser {
    pub id: String,
    pub username: String,
    pub avatar: Option<String>,
    pub access_token: String,
}

/// Extracts authenticated user from session cookie
impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        // Try session cookie first
        if let Some(cookie_header) = parts.headers.get(header::COOKIE) {
            if let Ok(cookie_str) = cookie_header.to_str() {
                for cookie in cookie_str.split(';') {
                    let cookie = cookie.trim();
                    if let Some(session_id) = cookie.strip_prefix("session_id=") {
                        if let Some(user) = get_session_user(&state.db, session_id).await? {
                            return Ok(user);
                        }
                    }
                }
            }
        }

        Err(AppError::Unauthorized)
    }
}

/// API key auth for bot-to-backend routes
#[derive(Debug, Clone)]
pub struct BotAuth;

impl FromRequestParts<AppState> for BotAuth {
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        if let Some(api_key) = parts.headers.get("x-api-key") {
            if let Ok(key) = api_key.to_str() {
                if key == state.config.bot_api_key {
                    return Ok(BotAuth);
                }
            }
        }

        Err(AppError::Unauthorized)
    }
}

async fn get_session_user(db: &SqlitePool, session_id: &str) -> Result<Option<AuthUser>, AppError> {
    let row = sqlx::query_as::<_, SessionRow>(
        "SELECT user_id, username, avatar, access_token, expires_at FROM sessions WHERE id = ?",
    )
    .bind(session_id)
    .fetch_optional(db)
    .await?;

    match row {
        Some(session) => {
            // Check expiration
            if let Ok(expires) = chrono::NaiveDateTime::parse_from_str(&session.expires_at, "%Y-%m-%d %H:%M:%S") {
                let now = chrono::Utc::now().naive_utc();
                if now > expires {
                    // Session expired, clean up
                    sqlx::query("DELETE FROM sessions WHERE id = ?")
                        .bind(session_id)
                        .execute(db)
                        .await?;
                    return Ok(None);
                }
            }

            Ok(Some(AuthUser {
                id: session.user_id,
                username: session.username,
                avatar: session.avatar,
                access_token: session.access_token,
            }))
        }
        None => Ok(None),
    }
}

#[derive(sqlx::FromRow)]
struct SessionRow {
    user_id: String,
    username: String,
    avatar: Option<String>,
    access_token: String,
    expires_at: String,
}
