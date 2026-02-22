use serde::{Deserialize, Serialize};

use crate::config::Config;

#[derive(Debug, Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: u64,
    pub refresh_token: Option<String>,
    pub scope: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiscordUser {
    pub id: String,
    pub username: String,
    pub avatar: Option<String>,
    pub discriminator: Option<String>,
    pub global_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiscordGuild {
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
    pub permissions: Option<String>,
}

pub fn get_oauth_url(config: &Config, redirect_path: &str) -> String {
    let redirect_uri = format!("{}/api/v1/auth/callback", config.web_url);
    let state = base64_encode(&serde_json::json!({ "redirect": redirect_path }).to_string());

    format!(
        "https://discord.com/api/oauth2/authorize?client_id={}&redirect_uri={}&response_type=code&scope=identify%20guilds&state={}",
        config.client_id,
        urlencoding::encode(&redirect_uri),
        state
    )
}

pub async fn exchange_code(
    http: &reqwest::Client,
    config: &Config,
    code: &str,
) -> Result<TokenResponse, reqwest::Error> {
    let redirect_uri = format!("{}/api/v1/auth/callback", config.web_url);

    http.post("https://discord.com/api/oauth2/token")
        .form(&[
            ("client_id", config.client_id.as_str()),
            ("client_secret", config.client_secret.as_str()),
            ("grant_type", "authorization_code"),
            ("code", code),
            ("redirect_uri", &redirect_uri),
        ])
        .send()
        .await?
        .json::<TokenResponse>()
        .await
}

pub async fn get_user(
    http: &reqwest::Client,
    access_token: &str,
) -> Result<DiscordUser, reqwest::Error> {
    http.get("https://discord.com/api/users/@me")
        .header("Authorization", format!("Bearer {access_token}"))
        .send()
        .await?
        .json::<DiscordUser>()
        .await
}

pub async fn get_user_guilds(
    http: &reqwest::Client,
    access_token: &str,
) -> Result<Vec<DiscordGuild>, reqwest::Error> {
    http.get("https://discord.com/api/users/@me/guilds")
        .header("Authorization", format!("Bearer {access_token}"))
        .send()
        .await?
        .json::<Vec<DiscordGuild>>()
        .await
}

/// Check if user has ADMINISTRATOR (0x8) or MANAGE_GUILD (0x20) permission
pub fn has_guild_access(permissions: &str) -> bool {
    if let Ok(perms) = permissions.parse::<u64>() {
        (perms & 0x8) != 0 || (perms & 0x20) != 0
    } else {
        false
    }
}

fn base64_encode(data: &str) -> String {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.encode(data.as_bytes())
}

pub fn base64_decode(data: &str) -> Option<String> {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD
        .decode(data)
        .ok()
        .and_then(|bytes| String::from_utf8(bytes).ok())
}

mod urlencoding {
    pub fn encode(input: &str) -> String {
        let mut result = String::new();
        for byte in input.bytes() {
            match byte {
                b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                    result.push(byte as char);
                }
                _ => {
                    result.push_str(&format!("%{byte:02X}"));
                }
            }
        }
        result
    }
}
