import { baseStyles } from "./styles.js";

export function homePage(user: any): string {
  const avatarUrl = user?.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    : "https://cdn.discordapp.com/embed/avatars/0.png";

  return `<!DOCTYPE html>
<html lang="en"><head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bot Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>${baseStyles}
    .landing { min-height: 100vh; display: flex; flex-direction: column; }
    .nav { padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; background: var(--bg-secondary); }
    .nav-brand { font-size: 24px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 12px; }
    .nav-links { display: flex; align-items: center; gap: 20px; }
    .hero { flex: 1; display: flex; align-items: center; justify-content: center; text-align: center; padding: 60px 20px; }
    .hero-content { max-width: 800px; }
    .hero h1 { font-size: 56px; font-weight: 700; color: var(--text-primary); margin-bottom: 24px; line-height: 1.2; }
    .hero h1 span { background: linear-gradient(135deg, var(--accent), #7c3aed); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .hero p { font-size: 20px; color: var(--text-secondary); margin-bottom: 40px; }
    .hero-buttons { display: flex; gap: 16px; justify-content: center; }
    .features { padding: 80px 40px; background: var(--bg-secondary); }
    .features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; max-width: 1200px; margin: 0 auto; }
    .feature-card { background: var(--bg-card); padding: 32px; border-radius: 16px; border: 1px solid var(--border); transition: all 0.3s; }
    .feature-card:hover { transform: translateY(-4px); border-color: var(--accent); }
    .feature-icon { width: 48px; height: 48px; background: linear-gradient(135deg, var(--accent), #7c3aed); border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; }
    .feature-card h3 { color: var(--text-primary); margin-bottom: 12px; }
    .user-badge { display: flex; align-items: center; gap: 10px; padding: 8px 16px; background: var(--bg-card); border-radius: 8px; }
    .user-badge img { width: 32px; height: 32px; border-radius: 50%; }
    @media (max-width: 768px) { .hero h1 { font-size: 36px; } .features-grid { grid-template-columns: 1fr; } }
  </style>
</head><body>
  <div class="landing">
    <nav class="nav">
      <div class="nav-brand">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
        </svg>
        Dashboard
      </div>
      <div class="nav-links">
        ${user ? `
          <div class="user-badge">
            <img src="${avatarUrl}" alt="${user.username}">
            <span style="color: var(--text-primary)">${user.username}</span>
          </div>
          <a href="/dashboard" class="btn btn-primary">Dashboard</a>
          <a href="/auth/logout" class="btn btn-secondary">Logout</a>
        ` : `
          <a href="/auth/login" class="btn btn-primary">Login with Discord</a>
        `}
      </div>
    </nav>

    <div class="hero">
      <div class="hero-content fade-in">
        <h1>Manage Your Server<br>Like a <span>Pro</span></h1>
        <p>The most powerful and complete Discord bot dashboard. Tickets, moderation, giveaways, reaction roles, and much more.</p>
        <div class="hero-buttons">
          ${user ? `
            <a href="/dashboard" class="btn btn-primary" style="padding: 16px 32px; font-size: 16px;">Open Dashboard</a>
          ` : `
            <a href="/auth/login" class="btn btn-primary" style="padding: 16px 32px; font-size: 16px;">Get Started</a>
          `}
          <a href="#features" class="btn btn-secondary" style="padding: 16px 32px; font-size: 16px;">Learn More</a>
        </div>
      </div>
    </div>

    <div class="features" id="features">
      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon"><svg width="24" height="24" fill="white" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8l8 5 8-5v10zm-8-7L4 6h16l-8 5z"/></svg></div>
          <h3>Ticket System</h3>
          <p>Complete ticket management with categories, transcripts, reviews and auto-close.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon"><svg width="24" height="24" fill="white" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg></div>
          <h3>Moderation</h3>
          <p>Warns, bans, kicks with complete history and detailed logs.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon"><svg width="24" height="24" fill="white" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z"/></svg></div>
          <h3>XP & Levels</h3>
          <p>Complete leveling system with leaderboard and level roles.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon"><svg width="24" height="24" fill="white" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg></div>
          <h3>Giveaways</h3>
          <p>Create and manage giveaways with requirements and multiple winners.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon"><svg width="24" height="24" fill="white" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg></div>
          <h3>Reaction Roles</h3>
          <p>Let members choose their roles with buttons or dropdown menus.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon"><svg width="24" height="24" fill="white" viewBox="0 0 24 24"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/></svg></div>
          <h3>Embed Builder</h3>
          <p>Advanced visual editor with drag & drop and Discord components v2.</p>
        </div>
      </div>
    </div>
  </div>
</body></html>`;
}

export function dashboardPage(user: any): string {
  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    : "https://cdn.discordapp.com/embed/avatars/0.png";

  return `<!DOCTYPE html>
<html lang="en"><head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Select Server - Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>${baseStyles}
    .header { background: var(--bg-secondary); padding: 16px 32px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 100; }
    .header h1 { font-size: 20px; color: var(--text-primary); }
    .user-menu { display: flex; align-items: center; gap: 16px; }
    .user-menu img { width: 36px; height: 36px; border-radius: 50%; }
    .container { max-width: 1400px; margin: 0 auto; padding: 32px; }
    .guild-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
    .guild-card { display: flex; align-items: center; gap: 16px; padding: 20px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; cursor: pointer; transition: all 0.3s; text-decoration: none; }
    .guild-card:hover { border-color: var(--accent); transform: translateY(-2px); box-shadow: 0 8px 24px var(--shadow); }
    .guild-icon { width: 64px; height: 64px; border-radius: 16px; background: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; color: #fff; overflow: hidden; }
    .guild-icon img { width: 100%; height: 100%; object-fit: cover; }
    .guild-info { flex: 1; }
    .guild-info h3 { font-size: 16px; color: var(--text-primary); margin-bottom: 4px; }
    .guild-info p { font-size: 14px; color: var(--text-muted); }
    .guild-arrow { color: var(--text-muted); transition: all 0.2s; }
    .guild-card:hover .guild-arrow { color: var(--accent); transform: translateX(4px); }
  </style>
</head><body>
  <div class="header">
    <h1>Select a Server</h1>
    <div class="user-menu">
      <img src="${avatarUrl}" alt="${user.username}">
      <span style="color: var(--text-primary)">${user.username}</span>
      <a href="/my-transcripts" class="btn btn-secondary btn-sm">My Transcripts</a>
      <a href="/auth/logout" class="btn btn-secondary btn-sm">Logout</a>
    </div>
  </div>

  <div class="container">
    <div id="guilds" class="guild-grid">
      <div class="loading"><div class="spinner"></div></div>
    </div>
  </div>

  <script>
    async function loadGuilds() {
      const res = await fetch('/api/guilds');
      const guilds = await res.json();
      const container = document.getElementById('guilds');

      if (!guilds.length) {
        container.innerHTML = '<div class="empty-state"><h3>No servers found</h3><p>Make sure the bot is in your server and you have admin permissions.</p></div>';
        return;
      }

      container.innerHTML = guilds.map(g => \`
        <a href="/dashboard/\${g.id}" class="guild-card">
          <div class="guild-icon">
            \${g.icon ? \`<img src="https://cdn.discordapp.com/icons/\${g.id}/\${g.icon}.png?size=128">\` : g.name[0].toUpperCase()}
          </div>
          <div class="guild-info">
            <h3>\${g.name}</h3>
            <p>\${g.memberCount.toLocaleString()} members</p>
          </div>
          <div class="guild-arrow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
          </div>
        </a>
      \`).join('');
    }
    loadGuilds();
  </script>
</body></html>`;
}

export function transcriptsPage(user: any, transcripts: any[]): string {
  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    : "https://cdn.discordapp.com/embed/avatars/0.png";

  return `<!DOCTYPE html>
<html lang="en"><head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Transcripts</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>${baseStyles}
    .header { background: var(--bg-secondary); padding: 16px 32px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); }
    .header h1 { font-size: 20px; color: var(--text-primary); }
    .container { max-width: 1000px; margin: 0 auto; padding: 32px; }
    .transcript-item { display: flex; justify-content: space-between; align-items: center; padding: 20px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 12px; }
    .transcript-info h3 { color: var(--text-primary); margin-bottom: 4px; }
    .transcript-info p { font-size: 13px; color: var(--text-muted); }
    .transcript-meta { display: flex; gap: 16px; font-size: 12px; color: var(--text-muted); margin-top: 8px; }
  </style>
</head><body>
  <div class="header">
    <h1>My Transcripts</h1>
    <div style="display: flex; align-items: center; gap: 16px;">
      <img src="${avatarUrl}" alt="${user.username}" style="width: 32px; height: 32px; border-radius: 50%;">
      <a href="/dashboard" class="btn btn-secondary btn-sm">Dashboard</a>
    </div>
  </div>
  <div class="container">
    ${transcripts.length === 0 ? `
      <div class="empty-state">
        <h3>No transcripts</h3>
        <p>Your closed tickets will appear here.</p>
      </div>
    ` : transcripts.map(t => `
      <div class="transcript-item">
        <div class="transcript-info">
          <h3>Ticket #${t.ticketNumber.toString().padStart(4, '0')} - ${t.guildName}</h3>
          <p>${t.subject || 'No subject'}</p>
          <div class="transcript-meta">
            <span>${t.messageCount} messages</span>
            <span>${new Date(t.createdAt).toLocaleDateString('en-US')}</span>
          </div>
        </div>
        <a href="/transcript/${t.id}" class="btn btn-primary btn-sm">View</a>
      </div>
    `).join('')}
  </div>
</body></html>`;
}

export function errorPage(code: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en"><head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error ${code}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>${baseStyles}
    .error-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; text-align: center; }
    .error-code { font-size: 120px; font-weight: 700; color: var(--danger); line-height: 1; }
    .error-message { font-size: 20px; color: var(--text-secondary); margin: 16px 0 32px; }
  </style>
</head><body>
  <div class="error-page">
    <div>
      <div class="error-code">${code}</div>
      <p class="error-message">${message}</p>
      <a href="/" class="btn btn-primary">Back to Home</a>
    </div>
  </div>
</body></html>`;
}

export { guildDashboardPage } from "./dashboard.js";
