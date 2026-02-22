use sqlx::SqlitePool;

use crate::error::AppResult;
use crate::models::User;

/// XP required to reach a given level.
///
/// Uses the formula: `5 * level^2 + 50 * level + 100`.
/// This is the XP needed *for that level alone*, not cumulative.
pub fn calculate_level(xp: i64) -> i64 {
    let mut level: i64 = 0;
    let mut remaining = xp;

    loop {
        let needed = xp_for_level(level + 1);
        if remaining < needed {
            break;
        }
        remaining -= needed;
        level += 1;
    }

    level
}

/// XP required to go from `level - 1` to `level`.
fn xp_for_level(level: i64) -> i64 {
    5 * level * level + 50 * level + 100
}

/// Fetch an existing user row, or create one if it does not exist.
pub async fn get_or_create_user(pool: &SqlitePool, user_id: &str) -> AppResult<User> {
    // Try to get the user first.
    let existing = sqlx::query_as::<_, User>(
        "SELECT id, xp, level, balance, last_daily, visible_xp, created_at, updated_at \
         FROM users WHERE id = ?",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    if let Some(user) = existing {
        return Ok(user);
    }

    // Insert a new user row with defaults.
    sqlx::query("INSERT INTO users (id) VALUES (?)")
        .bind(user_id)
        .execute(pool)
        .await?;

    let user = sqlx::query_as::<_, User>(
        "SELECT id, xp, level, balance, last_daily, visible_xp, created_at, updated_at \
         FROM users WHERE id = ?",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(user)
}

/// Add XP to a user, respecting the guild's cooldown setting.
///
/// 1. Fetches (or creates) the user row.
/// 2. Checks if `updated_at` + `cooldown_seconds` has passed. If not, returns
///    the current user without granting XP.
/// 3. Adds a random amount of XP between `xp_min` and `xp_max`.
/// 4. Recalculates the level. If the level changed, updates it too.
/// 5. Returns the updated user and whether a level-up occurred.
pub async fn add_xp(
    pool: &SqlitePool,
    user_id: &str,
    xp_min: i64,
    xp_max: i64,
    cooldown_seconds: i64,
) -> AppResult<AddXpResult> {
    let user = get_or_create_user(pool, user_id).await?;

    // Cooldown check: use `updated_at` as the "last XP grant" timestamp.
    let now = chrono::Utc::now();
    if let Ok(last_update) = chrono::NaiveDateTime::parse_from_str(&user.updated_at, "%Y-%m-%d %H:%M:%S") {
        let last_utc = last_update.and_utc();
        let elapsed = now.signed_duration_since(last_utc).num_seconds();
        if elapsed < cooldown_seconds {
            return Ok(AddXpResult {
                user,
                leveled_up: false,
                xp_gained: 0,
            });
        }
    }

    // Determine the XP to award.
    let xp_gained = if xp_min >= xp_max {
        xp_min
    } else {
        // Simple pseudo-random in [xp_min, xp_max] without the `rand` crate.
        let seed = now.timestamp_nanos_opt().unwrap_or(0) as u64;
        let range = (xp_max - xp_min + 1) as u64;
        xp_min + (seed % range) as i64
    };

    let new_xp = user.xp + xp_gained;
    let new_level = calculate_level(new_xp);
    let leveled_up = new_level > user.level;

    sqlx::query(
        "UPDATE users SET xp = ?, level = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(new_xp)
    .bind(new_level)
    .bind(user_id)
    .execute(pool)
    .await?;

    let updated = sqlx::query_as::<_, User>(
        "SELECT id, xp, level, balance, last_daily, visible_xp, created_at, updated_at \
         FROM users WHERE id = ?",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(AddXpResult {
        user: updated,
        leveled_up,
        xp_gained,
    })
}

/// Result of an `add_xp` call.
#[derive(Debug)]
pub struct AddXpResult {
    pub user: User,
    pub leveled_up: bool,
    pub xp_gained: i64,
}

/// Fetch a single user's leveling data.
pub async fn get_user(pool: &SqlitePool, user_id: &str) -> AppResult<Option<User>> {
    let user = sqlx::query_as::<_, User>(
        "SELECT id, xp, level, balance, last_daily, visible_xp, created_at, updated_at \
         FROM users WHERE id = ?",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    Ok(user)
}

/// Get the XP leaderboard, optionally filtered to a set of guild member IDs.
///
/// * `member_ids` - If `Some`, only users whose ID is in this list are included.
///                  If `None`, all users are returned.
/// * `limit`      - Maximum rows to return.
pub async fn get_leaderboard(
    pool: &SqlitePool,
    member_ids: Option<&[String]>,
    limit: i64,
) -> AppResult<Vec<User>> {
    let users = if let Some(ids) = member_ids {
        if ids.is_empty() {
            return Ok(Vec::new());
        }

        // Build a comma-separated list of placeholders.
        let placeholders: String = ids.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
        let sql = format!(
            "SELECT id, xp, level, balance, last_daily, visible_xp, created_at, updated_at \
             FROM users WHERE visible_xp = 1 AND id IN ({placeholders}) \
             ORDER BY xp DESC LIMIT ?",
        );

        let mut query = sqlx::query_as::<_, User>(&sql);
        for id in ids {
            query = query.bind(id);
        }
        query = query.bind(limit);

        query.fetch_all(pool).await?
    } else {
        sqlx::query_as::<_, User>(
            "SELECT id, xp, level, balance, last_daily, visible_xp, created_at, updated_at \
             FROM users WHERE visible_xp = 1 ORDER BY xp DESC LIMIT ?",
        )
        .bind(limit)
        .fetch_all(pool)
        .await?
    };

    Ok(users)
}
