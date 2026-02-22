import { baseStyles } from "./styles.js";

export function guildDashboardPage(user: any, guildId: string): string {
  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    : "https://cdn.discordapp.com/embed/avatars/0.png";

  return `<!DOCTYPE html>
<html lang="en"><head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="/socket.io/socket.io.js"></script>
  <style>${baseStyles}
    .layout { display: flex; min-height: 100vh; }
    .sidebar { width: 260px; background: var(--bg-secondary); border-right: 1px solid var(--border); position: fixed; top: 0; bottom: 0; left: 0; overflow-y: auto; z-index: 100; }
    .sidebar-header { padding: 20px; border-bottom: 1px solid var(--border); }
    .sidebar-header h2 { font-size: 16px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sidebar-header p { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
    .sidebar-nav { padding: 12px; }
    .nav-section { margin-bottom: 20px; }
    .nav-section-title { font-size: 11px; color: var(--text-muted); text-transform: uppercase; padding: 8px 12px; letter-spacing: 0.5px; }
    .nav-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; color: var(--text-secondary); border-radius: 8px; cursor: pointer; transition: all 0.2s; margin-bottom: 4px; }
    .nav-item:hover { background: var(--bg-hover); color: var(--text-primary); }
    .nav-item.active { background: var(--bg-hover); color: var(--text-primary); border-left: 2px solid var(--text-primary); }
    .nav-item svg { width: 20px; height: 20px; flex-shrink: 0; }
    .main { flex: 1; margin-left: 260px; }
    .topbar { background: var(--bg-secondary); padding: 16px 32px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 50; }
    .topbar-title { font-size: 20px; font-weight: 600; color: var(--text-primary); }
    .user-menu { display: flex; align-items: center; gap: 12px; }
    .user-menu img { width: 36px; height: 36px; border-radius: 50%; }
    .content { padding: 32px; max-width: 1600px; }
    .page { display: none; }
    .page.active { display: block; animation: fadeIn 0.3s ease; }

    /* Ticket styles */
    .ticket-list { display: flex; flex-direction: column; gap: 8px; max-height: 500px; overflow-y: auto; }
    .ticket-item { display: flex; align-items: center; justify-content: space-between; padding: 16px; background: var(--bg-tertiary); border-radius: 8px; cursor: pointer; transition: all 0.2s; border-left: 3px solid var(--border); }
    .ticket-item:hover { background: var(--bg-hover); }
    .ticket-item.open { border-left-color: var(--success); }
    .ticket-item.closed { border-left-color: var(--danger); }
    .ticket-info { display: flex; align-items: center; gap: 16px; }
    .ticket-number { font-weight: 600; color: var(--text-primary); }
    .ticket-subject { color: var(--text-secondary); font-size: 14px; }
    .ticket-meta { display: flex; gap: 12px; align-items: center; }

    /* Embed editor */
    .embed-editor { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .embed-preview-container { position: sticky; top: 100px; }
    .discord-embed { background: var(--bg-tertiary); border-radius: 4px; padding: 16px; border-left: 4px solid #5865f2; max-width: 520px; }
    .embed-author { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 14px; }
    .embed-author img { width: 24px; height: 24px; border-radius: 50%; }
    .embed-title { font-weight: 600; color: var(--text-primary); margin-bottom: 8px; }
    .embed-description { color: var(--text-secondary); white-space: pre-wrap; font-size: 14px; }
    .embed-fields { display: grid; gap: 8px; margin-top: 12px; }
    .embed-field { background: rgba(0,0,0,0.1); padding: 8px; border-radius: 4px; }
    .embed-field-name { font-weight: 600; color: var(--text-primary); font-size: 14px; }
    .embed-field-value { color: var(--text-secondary); font-size: 14px; }
    .embed-image { margin-top: 12px; max-width: 100%; border-radius: 4px; }
    .embed-footer { display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 12px; color: var(--text-muted); }
    .embed-footer img { width: 20px; height: 20px; border-radius: 50%; }

    /* Components editor */
    .component-row { background: var(--bg-tertiary); padding: 12px; border-radius: 8px; margin-bottom: 8px; }
    .component-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
    .discord-button { padding: 8px 16px; border-radius: 4px; font-size: 14px; font-weight: 500; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
    .discord-button.Primary { background: #5865f2; color: #fff; }
    .discord-button.Secondary { background: #4f545c; color: #fff; }
    .discord-button.Success { background: var(--success); color: #000; }
    .discord-button.Danger { background: var(--danger); color: #fff; }
    .discord-button.Link { background: #4f545c; color: #fff; }
    .discord-select { width: 100%; padding: 10px; background: var(--bg-primary); color: var(--text-muted); border: 1px solid var(--border); border-radius: 4px; }

    /* Drag drop */
    .draggable { cursor: grab; }
    .draggable:active { cursor: grabbing; }
    .drag-over { border: 2px dashed var(--text-muted) !important; }
    .field-item { display: flex; gap: 12px; align-items: start; padding: 12px; background: var(--bg-tertiary); border-radius: 8px; margin-bottom: 8px; }
    .field-drag { cursor: grab; color: var(--text-muted); padding: 4px; }
    .field-content { flex: 1; }
    .field-actions { display: flex; gap: 8px; }

    /* Config sections */
    .config-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px; }
    .config-section { background: var(--bg-card); border-radius: 12px; padding: 24px; border: 1px solid var(--border); }
    .config-section h3 { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
    .config-section h3 svg { width: 20px; height: 20px; color: var(--text-secondary); }

    /* Reaction roles */
    .role-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: var(--bg-tertiary); border-radius: 20px; margin: 4px; font-size: 13px; }
    .role-chip .color { width: 12px; height: 12px; border-radius: 50%; }

    /* Giveaway card */
    .giveaway-card { background: var(--bg-card); border-radius: 12px; padding: 20px; border: 1px solid var(--border); margin-bottom: 16px; }
    .giveaway-header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px; }
    .giveaway-prize { font-size: 18px; font-weight: 600; color: var(--text-primary); }
    .giveaway-meta { display: flex; gap: 16px; color: var(--text-muted); font-size: 13px; }
    .giveaway-countdown { font-size: 24px; font-weight: 700; color: var(--text-primary); }

    /* Leaderboard */
    .leaderboard-item { display: flex; align-items: center; gap: 16px; padding: 16px; background: var(--bg-tertiary); border-radius: 8px; margin-bottom: 8px; }
    .leaderboard-rank { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-weight: 700; }
    .rank-1 { background: linear-gradient(135deg, #ffd700, #ffb700); color: #000; }
    .rank-2 { background: linear-gradient(135deg, #c0c0c0, #a0a0a0); color: #000; }
    .rank-3 { background: linear-gradient(135deg, #cd7f32, #b87333); color: #fff; }
    .leaderboard-user { display: flex; align-items: center; gap: 12px; flex: 1; }
    .leaderboard-user img { width: 40px; height: 40px; border-radius: 50%; }
    .leaderboard-xp { text-align: right; }
    .leaderboard-xp .level { font-weight: 600; color: var(--text-primary); }
    .leaderboard-xp .xp { font-size: 13px; color: var(--text-muted); }

    /* Logs */
    .log-entry { display: flex; gap: 16px; padding: 12px; background: var(--bg-tertiary); border-radius: 8px; margin-bottom: 8px; font-size: 13px; }
    .log-time { color: var(--text-muted); min-width: 80px; }
    .log-action { font-weight: 500; min-width: 150px; }
    .log-action.success { color: var(--success); }
    .log-action.danger { color: var(--danger); }
    .log-action.warning { color: var(--warning); }
    .log-action.info { color: #5865f2; }
    .log-details { color: var(--text-secondary); flex: 1; }

    /* Ticket detail */
    .ticket-detail { display: grid; grid-template-columns: 1fr 320px; gap: 24px; }
    .ticket-messages { background: var(--bg-tertiary); border-radius: 12px; max-height: 600px; overflow-y: auto; }
    .message { display: flex; gap: 12px; padding: 16px; }
    .message:hover { background: rgba(0,0,0,0.1); }
    .message-avatar { width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; }
    .message-content { flex: 1; }
    .message-header { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
    .message-author { font-weight: 600; color: var(--text-primary); }
    .message-time { font-size: 12px; color: var(--text-muted); }
    .message-text { color: var(--text-secondary); white-space: pre-wrap; word-break: break-word; }
    .ticket-sidebar { display: flex; flex-direction: column; gap: 16px; }

    /* Welcome preview */
    .welcome-preview { background: var(--bg-tertiary); border-radius: 8px; padding: 20px; }
    .welcome-preview .message { background: none; padding: 0; }

    /* Auto role item */
    .auto-role-item { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--bg-tertiary); border-radius: 8px; margin-bottom: 8px; }

    /* Warn item */
    .warn-item { background: var(--bg-tertiary); border-radius: 8px; padding: 16px; margin-bottom: 8px; border-left: 3px solid var(--warning); }
    .warn-header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px; }
    .warn-user { display: flex; align-items: center; gap: 10px; }
    .warn-user img { width: 32px; height: 32px; border-radius: 50%; }
    .warn-reason { color: var(--text-secondary); font-size: 14px; }
    .warn-meta { font-size: 12px; color: var(--text-muted); margin-top: 8px; }

    @media (max-width: 1200px) { .embed-editor, .ticket-detail { grid-template-columns: 1fr; } }
    @media (max-width: 768px) { .sidebar { display: none; } .main { margin-left: 0; } }
  </style>
</head><body>
  <div class="layout">
    <aside class="sidebar scrollbar">
      <div class="sidebar-header">
        <h2 id="guildName">Loading...</h2>
        <p><a href="/dashboard" style="color: var(--text-muted);">← Back to servers</a></p>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-section">
          <div class="nav-section-title">Overview</div>
          <div class="nav-item active" data-page="home">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Home
          </div>
          <div class="nav-item" data-page="logs">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            Activity Logs
          </div>
        </div>
        <div class="nav-section">
          <div class="nav-section-title">Management</div>
          <div class="nav-item" data-page="tickets">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            Tickets
          </div>
          <div class="nav-item" data-page="moderation">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Moderation
          </div>
          <div class="nav-item" data-page="giveaways">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
            Giveaways
          </div>
        </div>
        <div class="nav-section">
          <div class="nav-section-title">Engagement</div>
          <div class="nav-item" data-page="reaction-roles">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
            Reaction Roles
          </div>
          <div class="nav-item" data-page="auto-roles">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Auto Roles
          </div>
          <div class="nav-item" data-page="leaderboard">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            Leaderboard
          </div>
          <div class="nav-item" data-page="welcome">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Welcome
          </div>
        </div>
        <div class="nav-section">
          <div class="nav-section-title">Tools</div>
          <div class="nav-item" data-page="embed">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="12" y2="17"/></svg>
            Embed Builder
          </div>
        </div>
        <div class="nav-section">
          <div class="nav-section-title">Settings</div>
          <div class="nav-item" data-page="config">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Configuration
          </div>
        </div>
      </nav>
    </aside>

    <main class="main">
      <header class="topbar">
        <h1 class="topbar-title" id="pageTitle">Home</h1>
        <div class="user-menu">
          <img src="${avatarUrl}" alt="${user.username}">
          <span style="color: var(--text-primary)">${user.username}</span>
        </div>
      </header>

      <div class="content">
        ${getHomePageHtml()}
        ${getTicketsPageHtml()}
        ${getTicketDetailHtml()}
        ${getEmbedPageHtml()}
        ${getReactionRolesPageHtml()}
        ${getGiveawaysPageHtml()}
        ${getWelcomePageHtml()}
        ${getLogsPageHtml()}
        ${getConfigPageHtml()}
        ${getModerationPageHtml()}
        ${getAutoRolesPageHtml()}
        ${getLeaderboardPageHtml()}
      </div>
    </main>
  </div>

  <div class="modal-overlay" id="modal">
    <div class="modal" id="modalContent"></div>
  </div>

  <div class="toast" id="toast"></div>

  <script>
${getMainScript(guildId)}
  </script>
</body></html>`;
}

function getHomePageHtml(): string {
  return `
    <div class="page active" id="page-home">
      <div class="grid grid-6" style="margin-bottom: 24px;">
        <div class="stat-card"><div class="stat-icon">👥</div><div class="stat-value" id="stat-members">-</div><div class="stat-label">Members</div></div>
        <div class="stat-card"><div class="stat-icon">🟢</div><div class="stat-value" id="stat-online">-</div><div class="stat-label">Online</div></div>
        <div class="stat-card"><div class="stat-icon">🎫</div><div class="stat-value" id="stat-tickets">-</div><div class="stat-label">Open Tickets</div></div>
        <div class="stat-card"><div class="stat-icon">📊</div><div class="stat-value" id="stat-total-tickets">-</div><div class="stat-label">Total Tickets</div></div>
        <div class="stat-card"><div class="stat-icon">🎤</div><div class="stat-value" id="stat-voice">-</div><div class="stat-label">In Voice</div></div>
        <div class="stat-card"><div class="stat-icon">💎</div><div class="stat-value" id="stat-boosts">-</div><div class="stat-label">Boosts</div></div>
      </div>
      <div class="grid grid-2">
        <div class="card">
          <h2>Recent Activity</h2>
          <div id="recent-activity" class="scrollbar" style="max-height: 400px; overflow-y: auto;">
            <div class="loading"><div class="spinner"></div></div>
          </div>
        </div>
        <div class="card">
          <h2>Quick Actions</h2>
          <div class="grid grid-2" style="gap: 12px;">
            <button class="btn btn-primary" onclick="showPage('embed')">Create Embed</button>
            <button class="btn btn-primary" onclick="showPage('giveaways')">New Giveaway</button>
            <button class="btn btn-secondary" onclick="showPage('tickets')">View Tickets</button>
            <button class="btn btn-secondary" onclick="showPage('config')">Settings</button>
          </div>
        </div>
      </div>
    </div>`;
}

function getTicketsPageHtml(): string {
  return `
    <div class="page" id="page-tickets">
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="margin: 0;">Tickets</h2>
          <div style="display: flex; gap: 12px;">
            <select id="ticket-filter" class="form-group" style="margin: 0; width: auto;" onchange="loadTickets()">
              <option value="all">All Tickets</option>
              <option value="open">Open Only</option>
              <option value="closed">Closed Only</option>
            </select>
          </div>
        </div>
        <div id="tickets-list" class="ticket-list scrollbar">
          <div class="loading"><div class="spinner"></div></div>
        </div>
        <div id="tickets-pagination" style="display: flex; justify-content: center; gap: 8px; margin-top: 16px;"></div>
      </div>
    </div>`;
}

function getTicketDetailHtml(): string {
  return `
    <div class="page" id="page-ticket-detail">
      <div style="margin-bottom: 16px;">
        <button class="btn btn-secondary btn-sm" onclick="showPage('tickets')">← Back to Tickets</button>
      </div>
      <div class="ticket-detail">
        <div>
          <div class="card" style="margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <h2 id="ticket-title" style="margin: 0;">Ticket #0000</h2>
                <p id="ticket-subject" style="color: var(--text-muted); margin-top: 4px;">Subject</p>
              </div>
              <div id="ticket-status-badge"></div>
            </div>
          </div>
          <div class="ticket-messages scrollbar" id="ticket-messages">
            <div class="loading"><div class="spinner"></div></div>
          </div>
          <div id="ticket-input-area" style="margin-top: 16px; display: none;">
            <div style="display: flex; gap: 12px;">
              <input type="text" id="ticket-message-input" placeholder="Type a message..." style="flex: 1; padding: 12px 16px; background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary);" onkeypress="if(event.key==='Enter')sendTicketMessage()">
              <button class="btn btn-primary" onclick="sendTicketMessage()">Send</button>
            </div>
          </div>
        </div>
        <div class="ticket-sidebar">
          <div class="card">
            <h3>Ticket Info</h3>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <div><span style="color: var(--text-muted); font-size: 12px;">CREATED BY</span><div id="ticket-user" style="display: flex; align-items: center; gap: 8px; margin-top: 4px;"></div></div>
              <div><span style="color: var(--text-muted); font-size: 12px;">CREATED AT</span><div id="ticket-created" style="margin-top: 4px;"></div></div>
              <div><span style="color: var(--text-muted); font-size: 12px;">CLAIMED BY</span><div id="ticket-claimed" style="margin-top: 4px;">Not claimed</div></div>
            </div>
          </div>
          <div class="card">
            <h3>Actions</h3>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <button class="btn btn-danger" id="btn-close-ticket" onclick="closeCurrentTicket()">Close Ticket</button>
              <a id="btn-view-transcript" class="btn btn-secondary" style="display: none;" target="_blank">View Transcript</a>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function getEmbedPageHtml(): string {
  return `
    <div class="page" id="page-embed">
      <div class="embed-editor">
        <div>
          <div class="card">
            <h2>Message Builder</h2>
            <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 20px;">Components V2 - The new Discord message format</p>

            <div class="form-group">
              <label>Title</label>
              <input type="text" id="msg-title" placeholder="Message title" oninput="updatePreview()">
            </div>

            <div class="form-group">
              <label>Description</label>
              <textarea id="msg-desc" rows="5" placeholder="Message content (supports **bold**, *italic*, -# small text)" oninput="updatePreview()"></textarea>
            </div>

            <div class="form-group">
              <label>Couleur</label>
              <input type="color" id="msg-color" value="#5865f2" oninput="updatePreview()">
            </div>

            <div class="form-group">
              <label>Image URL (optional)</label>
              <input type="url" id="msg-image" placeholder="https://..." oninput="updatePreview()">
            </div>

            <div class="form-group">
              <label>Footer (optional)</label>
              <input type="text" id="msg-footer" placeholder="Small text at the bottom" oninput="updatePreview()">
            </div>

            <div class="form-group">
              <label>Buttons</label>
              <div id="buttons-list"></div>
              <button class="btn btn-secondary btn-sm" onclick="addButton()">+ Add a button</button>
            </div>
          </div>

          <div class="card" style="margin-top: 16px;">
            <h2>Send</h2>
            <div class="form-group">
              <label>Channel</label>
              <select id="msg-channel"></select>
            </div>
            <button class="btn btn-primary" onclick="sendMessage()">Send</button>
          </div>
        </div>

        <div class="embed-preview-container">
          <div class="card">
            <h2>Preview</h2>
            <div class="discord-embed" id="msg-preview">
              <div style="color: var(--text-muted);">Start writing...</div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function getReactionRolesPageHtml(): string {
  return `
    <div class="page" id="page-reaction-roles">
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="margin: 0;">Reaction Roles</h2>
          <button class="btn btn-primary" onclick="showReactionRoleModal()">+ Create New</button>
        </div>
        <div id="reaction-roles-list">
          <div class="loading"><div class="spinner"></div></div>
        </div>
      </div>
    </div>`;
}

function getGiveawaysPageHtml(): string {
  return `
    <div class="page" id="page-giveaways">
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="margin: 0;">Giveaways</h2>
          <button class="btn btn-primary" onclick="showGiveawayModal()">+ Create Giveaway</button>
        </div>
        <div id="giveaways-list">
          <div class="loading"><div class="spinner"></div></div>
        </div>
      </div>
    </div>`;
}

function getWelcomePageHtml(): string {
  return `
    <div class="page" id="page-welcome">
      <div class="grid grid-2">
        <div class="card">
          <h2>Welcome Message</h2>
          <div class="form-group"><label>Welcome Channel</label><select id="welcome-channel"><option value="">Disabled</option></select></div>
          <div class="form-group"><label>Welcome Message</label><textarea id="welcome-message" rows="4" placeholder="Welcome {user} to {server}!"></textarea></div>
          <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
            <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">Available Variables:</p>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              <code style="background: var(--bg-primary); padding: 4px 8px; border-radius: 4px; font-size: 12px;">{user}</code>
              <code style="background: var(--bg-primary); padding: 4px 8px; border-radius: 4px; font-size: 12px;">{username}</code>
              <code style="background: var(--bg-primary); padding: 4px 8px; border-radius: 4px; font-size: 12px;">{server}</code>
              <code style="background: var(--bg-primary); padding: 4px 8px; border-radius: 4px; font-size: 12px;">{memberCount}</code>
            </div>
          </div>
          <button class="btn btn-success" onclick="saveWelcome()">Save Welcome Settings</button>
        </div>
        <div class="card">
          <h2>Leave Message</h2>
          <div class="form-group"><label>Leave Channel</label><select id="leave-channel"><option value="">Disabled</option></select></div>
          <div class="form-group"><label>Leave Message</label><textarea id="leave-message" rows="4" placeholder="{username} has left the server."></textarea></div>
          <button class="btn btn-success" onclick="saveLeave()">Save Leave Settings</button>
        </div>
      </div>
    </div>`;
}

function getLogsPageHtml(): string {
  return `
    <div class="page" id="page-logs">
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="margin: 0;">Dashboard Activity Logs</h2>
          <select id="logs-filter" style="padding: 8px 12px; background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 6px; color: var(--text-primary);">
            <option value="all">All Actions</option>
            <option value="config">Config Changes</option>
            <option value="ticket">Ticket Actions</option>
            <option value="giveaway">Giveaways</option>
            <option value="embed">Embeds</option>
          </select>
        </div>
        <div id="logs-list" class="scrollbar" style="max-height: 600px; overflow-y: auto;">
          <div class="loading"><div class="spinner"></div></div>
        </div>
      </div>
    </div>`;
}

function getConfigPageHtml(): string {
  return `
    <div class="page" id="page-config">
      <div class="config-grid">
        <div class="config-section">
          <h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg> Log Channels</h3>
          <div class="form-group"><label>All Logs</label><select id="cfg-allLogs"><option value="">None</option></select></div>
          <div class="form-group"><label>Mod Logs</label><select id="cfg-modLogs"><option value="">None</option></select></div>
          <div class="form-group"><label>Message Logs</label><select id="cfg-msgLogs"><option value="">None</option></select></div>
          <div class="form-group"><label>Voice Logs</label><select id="cfg-voiceLogs"><option value="">None</option></select></div>
          <div class="form-group"><label>Member Logs</label><select id="cfg-memberLogs"><option value="">None</option></select></div>
          <div class="form-group"><label>Server Logs</label><select id="cfg-serverLogs"><option value="">None</option></select></div>
          <div class="form-group"><label>Dashboard Logs</label><select id="cfg-dashboardLogs"><option value="">None</option></select></div>
        </div>

        <div class="config-section">
          <h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/></svg> Ticket System</h3>
          <div class="form-group"><label>Ticket Category</label><select id="cfg-ticketCategory"><option value="">None</option></select></div>
          <div class="form-group"><label>Support Role</label><select id="cfg-supportRole"><option value="">None</option></select></div>
          <div class="form-group"><label>Transcript Channel</label><select id="cfg-transcriptChannel"><option value="">None</option></select></div>
          <div class="form-group"><label>Review Channel (Staff)</label><select id="cfg-reviewChannel"><option value="">None</option></select></div>
          <div class="form-group"><label>Public Review Channel</label><select id="cfg-publicReviewChannel"><option value="">None</option></select></div>
        </div>

        <div class="config-section">
          <h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> XP System</h3>
          <div class="form-group"><label>Level Up Channel</label><select id="cfg-levelChannel"><option value="">Current channel</option></select></div>
          <div class="form-row">
            <div class="form-group"><label>XP Min</label><input type="number" id="cfg-xpMin" value="15"></div>
            <div class="form-group"><label>XP Max</label><input type="number" id="cfg-xpMax" value="25"></div>
          </div>
          <div class="form-group"><label>XP Cooldown (seconds)</label><input type="number" id="cfg-xpCooldown" value="60"></div>
          <div class="form-group"><label>Level Up Message</label><input type="text" id="cfg-levelMsg" placeholder="GG {user}, level {level}!"></div>
        </div>

        <div class="config-section">
          <h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/></svg> Other Settings</h3>
          <div class="form-group"><label>Suggestion Channel</label><select id="cfg-suggestionChannel"><option value="">None</option></select></div>
          <div class="form-group"><label>Starboard Channel</label><select id="cfg-starboardChannel"><option value="">None</option></select></div>
          <div class="form-group"><label>Starboard Threshold</label><input type="number" id="cfg-starboardThreshold" value="3"></div>
        </div>
      </div>
      <div style="margin-top: 24px; display: flex; gap: 12px;">
        <button class="btn btn-success" onclick="saveConfig()">Save All Settings</button>
        <button class="btn btn-secondary" onclick="loadConfig()">Reset Changes</button>
      </div>
    </div>`;
}

function getModerationPageHtml(): string {
  return `
    <div class="page" id="page-moderation">
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="margin: 0;">Warnings</h2>
          <div class="search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input type="text" id="warn-search" placeholder="Search by user ID..." onkeypress="if(event.key==='Enter')searchWarns()">
          </div>
        </div>
        <div id="warns-list" class="scrollbar" style="max-height: 600px; overflow-y: auto;">
          <div class="loading"><div class="spinner"></div></div>
        </div>
      </div>
    </div>`;
}

function getAutoRolesPageHtml(): string {
  return `
    <div class="page" id="page-auto-roles">
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="margin: 0;">Auto Roles</h2>
          <button class="btn btn-primary" onclick="showAutoRoleModal()">+ Add Auto Role</button>
        </div>
        <p style="color: var(--text-muted); margin-bottom: 16px;">Automatically assign roles when members join the server.</p>
        <div id="auto-roles-list">
          <div class="loading"><div class="spinner"></div></div>
        </div>
      </div>
    </div>`;
}

function getLeaderboardPageHtml(): string {
  return `
    <div class="page" id="page-leaderboard">
      <div class="card">
        <h2>XP Leaderboard</h2>
        <div id="leaderboard-list" class="scrollbar" style="max-height: 700px; overflow-y: auto;">
          <div class="loading"><div class="spinner"></div></div>
        </div>
      </div>
    </div>`;
}

function getMainScript(guildId: string): string {
  return `
const guildId = '${guildId}';
const socket = io();
let channels = [], roles = [], categories = [], config = {};
let currentTicket = null;

// Init
socket.emit('joinGuild', guildId);
socket.on('stats', updateStats);
socket.on('dashboardLog', data => addLogEntry(data));

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => showPage(item.dataset.page));
});

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const parent = tab.closest('.card');
    parent.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    parent.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).style.display = 'block';
  });
});

function showPage(page) {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  document.querySelector('[data-page="' + page + '"]')?.classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page)?.classList.add('active');
  document.getElementById('pageTitle').textContent = document.querySelector('[data-page="' + page + '"]')?.textContent.trim() || 'Dashboard';

  if (page === 'tickets') loadTickets();
  if (page === 'giveaways') loadGiveaways();
  if (page === 'reaction-roles') loadReactionRoles();
  if (page === 'auto-roles') loadAutoRoles();
  if (page === 'leaderboard') loadLeaderboard();
  if (page === 'moderation') loadWarns();
  if (page === 'logs') loadLogs();
}

function updateStats(data) {
  document.getElementById('stat-members').textContent = data.members?.toLocaleString() || '-';
  document.getElementById('stat-online').textContent = data.online?.toLocaleString() || '-';
  document.getElementById('stat-tickets').textContent = data.tickets?.open || '-';
  document.getElementById('stat-total-tickets').textContent = data.tickets?.total || '-';
  document.getElementById('stat-voice').textContent = data.voiceUsers || '-';
  document.getElementById('stat-boosts').textContent = data.boosts || '-';
}

async function loadAll() {
  const [gRes, cRes, rRes, catRes, cfgRes] = await Promise.all([
    fetch('/api/guilds'),
    fetch('/api/guilds/' + guildId + '/channels'),
    fetch('/api/guilds/' + guildId + '/roles'),
    fetch('/api/guilds/' + guildId + '/categories'),
    fetch('/api/guilds/' + guildId + '/config')
  ]);

  const guilds = await gRes.json();
  channels = await cRes.json();
  roles = await rRes.json();
  categories = await catRes.json();
  config = await cfgRes.json();

  const guild = guilds.find(g => g.id === guildId);
  if (guild) document.getElementById('guildName').textContent = guild.name;

  populateSelects();
  loadConfig();
  loadRecentActivity();
  loadStats();
}

function populateSelects() {
  const channelOpts = '<option value="">None</option>' + channels.map(c => '<option value="' + c.id + '">#' + c.name + '</option>').join('');
  const roleOpts = '<option value="">None</option>' + roles.map(r => '<option value="' + r.id + '">' + r.name + '</option>').join('');
  const catOpts = '<option value="">None</option>' + categories.map(c => '<option value="' + c.id + '">' + c.name + '</option>').join('');

  document.querySelectorAll('select[id^="cfg-"], #msg-channel, #welcome-channel, #leave-channel').forEach(s => {
    if (s.id.includes('Role') || s.id.includes('support')) s.innerHTML = roleOpts;
    else if (s.id.includes('Category')) s.innerHTML = catOpts;
    else s.innerHTML = channelOpts;
  });
}

function loadConfig() {
  const map = {
    'cfg-allLogs': 'allLogsChannel', 'cfg-modLogs': 'modLogsChannel', 'cfg-msgLogs': 'msgLogsChannel',
    'cfg-voiceLogs': 'voiceLogsChannel', 'cfg-memberLogs': 'memberLogsChannel', 'cfg-serverLogs': 'serverLogsChannel',
    'cfg-dashboardLogs': 'dashboardLogsChannel', 'cfg-ticketCategory': 'ticketCategoryId', 'cfg-supportRole': 'ticketSupportRole',
    'cfg-transcriptChannel': 'ticketTranscriptChannel', 'cfg-reviewChannel': 'ticketReviewChannel',
    'cfg-publicReviewChannel': 'ticketPublicReviewChannel', 'cfg-levelChannel': 'levelUpChannel',
    'cfg-suggestionChannel': 'suggestionChannel', 'cfg-starboardChannel': 'starboardChannel',
    'welcome-channel': 'welcomeChannel', 'leave-channel': 'leaveChannel'
  };
  for (const [id, key] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el && config[key]) el.value = config[key];
  }
  if (config.xpMin) document.getElementById('cfg-xpMin').value = config.xpMin;
  if (config.xpMax) document.getElementById('cfg-xpMax').value = config.xpMax;
  if (config.xpCooldown) document.getElementById('cfg-xpCooldown').value = config.xpCooldown;
  if (config.levelUpMessage) document.getElementById('cfg-levelMsg').value = config.levelUpMessage;
  if (config.starboardThreshold) document.getElementById('cfg-starboardThreshold').value = config.starboardThreshold;
  if (config.welcomeMessage) document.getElementById('welcome-message').value = config.welcomeMessage;
  if (config.leaveMessage) document.getElementById('leave-message').value = config.leaveMessage;
}

async function loadStats() {
  const res = await fetch('/api/guilds/' + guildId + '/stats');
  updateStats(await res.json());
}

async function loadRecentActivity() {
  const res = await fetch('/api/guilds/' + guildId + '/dashboard-logs');
  const logs = await res.json();
  const container = document.getElementById('recent-activity');
  if (!logs.length) { container.innerHTML = '<p style="color: var(--text-muted);">No recent activity</p>'; return; }
  container.innerHTML = logs.slice(0, 20).map(l => \`
    <div class="log-entry">
      <span class="log-time">\${new Date(l.timestamp).toLocaleTimeString()}</span>
      <span class="log-action info">\${l.action}</span>
      <span class="log-details">\${l.details}</span>
    </div>\`).join('');
}

async function loadTickets() {
  const filter = document.getElementById('ticket-filter').value;
  const res = await fetch('/api/guilds/' + guildId + '/tickets?status=' + filter);
  const data = await res.json();
  const container = document.getElementById('tickets-list');
  if (!data.tickets?.length) { container.innerHTML = '<div class="empty-state"><h3>No tickets</h3></div>'; return; }
  container.innerHTML = data.tickets.map(t => \`
    <div class="ticket-item \${t.status}" onclick="openTicket(\${t.id})">
      <div class="ticket-info">
        <span class="ticket-number">#\${t.number.toString().padStart(4,'0')}</span>
        <span class="ticket-subject">\${t.subject || 'No subject'}</span>
      </div>
      <div class="ticket-meta">
        <span class="badge badge-\${t.status === 'open' ? 'success' : 'danger'}">\${t.status}</span>
      </div>
    </div>\`).join('');
}

async function openTicket(id) {
  const res = await fetch('/api/guilds/' + guildId + '/tickets/' + id);
  const ticket = await res.json();
  currentTicket = ticket;

  document.getElementById('ticket-title').textContent = 'Ticket #' + ticket.number.toString().padStart(4,'0');
  document.getElementById('ticket-subject').textContent = ticket.subject || 'No subject';
  document.getElementById('ticket-status-badge').innerHTML = '<span class="badge badge-' + (ticket.status === 'open' ? 'success' : 'danger') + '">' + ticket.status + '</span>';
  document.getElementById('ticket-user').innerHTML = ticket.user ? '<img src="https://cdn.discordapp.com/avatars/' + ticket.user.id + '/' + ticket.user.avatar + '.png" style="width:24px;height:24px;border-radius:50%"><span>' + ticket.user.username + '</span>' : 'Unknown';
  document.getElementById('ticket-created').textContent = new Date(ticket.createdAt).toLocaleString();
  document.getElementById('ticket-claimed').textContent = ticket.claimedBy || 'Not claimed';

  const msgContainer = document.getElementById('ticket-messages');
  if (ticket.status === 'open' && ticket.messages?.length) {
    msgContainer.innerHTML = ticket.messages.map(m => \`
      <div class="message">
        <img class="message-avatar" src="https://cdn.discordapp.com/avatars/\${m.author.id}/\${m.author.avatar}.png" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
        <div class="message-content">
          <div class="message-header"><span class="message-author">\${m.author.username}</span><span class="message-time">\${new Date(m.timestamp).toLocaleTimeString()}</span></div>
          <div class="message-text">\${m.content || ''}</div>
        </div>
      </div>\`).join('');
    document.getElementById('ticket-input-area').style.display = 'block';
    document.getElementById('btn-close-ticket').style.display = 'block';
    document.getElementById('btn-view-transcript').style.display = 'none';
  } else {
    msgContainer.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-muted);">Ticket is closed. View transcript for messages.</div>';
    document.getElementById('ticket-input-area').style.display = 'none';
    document.getElementById('btn-close-ticket').style.display = 'none';
    if (ticket.transcriptId) {
      document.getElementById('btn-view-transcript').style.display = 'block';
      document.getElementById('btn-view-transcript').href = '/transcript/' + ticket.transcriptId;
    }
  }

  showPage('ticket-detail');
}

async function closeCurrentTicket() {
  if (!currentTicket) return;
  if (!confirm('Close this ticket?')) return;
  await fetch('/api/guilds/' + guildId + '/tickets/' + currentTicket.id + '/close', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}' });
  showToast('Ticket closed!', 'success');
  showPage('tickets');
}

function sendTicketMessage() {
  const input = document.getElementById('ticket-message-input');
  if (!input.value.trim() || !currentTicket) return;
  socket.emit('sendTicketMessage', { ticketId: currentTicket.id.toString(), content: input.value });
  input.value = '';
}

// Message Builder (Components V2)
let msgButtons = [];

function updatePreview() {
  const title = document.getElementById('msg-title')?.value || '';
  const desc = document.getElementById('msg-desc')?.value || '';
  const color = document.getElementById('msg-color')?.value || '#5865f2';
  const image = document.getElementById('msg-image')?.value || '';
  const footer = document.getElementById('msg-footer')?.value || '';

  let html = '';

  if (title) {
    html += '<div style="font-size:18px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">' + title + '</div>';
  }
  if (desc) {
    html += '<div style="color:var(--text-secondary);white-space:pre-wrap;font-size:14px;">' + desc.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>') + '</div>';
  }
  if (image) {
    html += '<div style="margin-top:12px;"><img src="' + image + '" style="max-width:100%;border-radius:8px;" onerror="this.style.display=\\'none\\'"></div>';
  }
  if (footer) {
    html += '<div style="border-top:1px solid var(--border);margin-top:12px;padding-top:8px;font-size:12px;color:var(--text-muted);">' + footer + '</div>';
  }
  if (msgButtons.length > 0) {
    html += '<div style="display:flex;gap:8px;margin-top:12px;">';
    msgButtons.forEach(b => {
      const colors = { Primary: '#5865f2', Secondary: '#4f545c', Success: '#57f287', Danger: '#ed4245' };
      html += '<button style="padding:8px 16px;border-radius:4px;border:none;background:' + (colors[b.style] || colors.Primary) + ';color:#fff;font-size:14px;">' + b.label + '</button>';
    });
    html += '</div>';
  }

  if (!html) html = '<div style="color: var(--text-muted);">Start writing...</div>';

  const preview = document.getElementById('msg-preview');
  if (preview) {
    preview.innerHTML = html;
    preview.style.borderLeftColor = color;
  }
}

function addButton() {
  msgButtons.push({ label: 'Button', style: 'Primary' });
  renderButtons();
}

function renderButtons() {
  const container = document.getElementById('buttons-list');
  if (!container) return;
  container.innerHTML = msgButtons.map((b, i) =>
    '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;padding:12px;background:var(--bg-tertiary);border-radius:8px;">' +
      '<input type="text" value="' + b.label + '" placeholder="Label" style="flex:1" onchange="msgButtons[' + i + '].label=this.value;updatePreview()">' +
      '<select onchange="msgButtons[' + i + '].style=this.value;updatePreview()">' +
        '<option ' + (b.style==='Primary'?'selected':'') + '>Primary</option>' +
        '<option ' + (b.style==='Secondary'?'selected':'') + '>Secondary</option>' +
        '<option ' + (b.style==='Success'?'selected':'') + '>Success</option>' +
        '<option ' + (b.style==='Danger'?'selected':'') + '>Danger</option>' +
      '</select>' +
      '<input type="url" value="' + (b.url||'') + '" placeholder="URL (optional)" style="width:180px" onchange="msgButtons[' + i + '].url=this.value">' +
      '<button class="btn btn-danger btn-sm" onclick="msgButtons.splice(' + i + ',1);renderButtons()">×</button>' +
    '</div>'
  ).join('');
  updatePreview();
}

async function sendMessage() {
  const channelId = document.getElementById('msg-channel')?.value;
  if (!channelId) return showToast('Select a channel', 'error');

  const data = {
    channelId,
    title: document.getElementById('msg-title')?.value || undefined,
    description: document.getElementById('msg-desc')?.value || undefined,
    color: parseInt((document.getElementById('msg-color')?.value || '#5865f2').replace('#',''), 16),
    image: document.getElementById('msg-image')?.value || undefined,
    footer: document.getElementById('msg-footer')?.value || undefined,
    buttons: msgButtons.length > 0 ? msgButtons : undefined
  };

  const res = await fetch('/api/send-embed', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(data)
  });

  if (res.ok) showToast('Message sent!', 'success');
  else showToast('Error', 'error');
}

// Config
async function saveConfig() {
  const data = {
    allLogsChannel: document.getElementById('cfg-allLogs').value || null,
    modLogsChannel: document.getElementById('cfg-modLogs').value || null,
    msgLogsChannel: document.getElementById('cfg-msgLogs').value || null,
    voiceLogsChannel: document.getElementById('cfg-voiceLogs').value || null,
    memberLogsChannel: document.getElementById('cfg-memberLogs').value || null,
    serverLogsChannel: document.getElementById('cfg-serverLogs').value || null,
    dashboardLogsChannel: document.getElementById('cfg-dashboardLogs').value || null,
    ticketCategoryId: document.getElementById('cfg-ticketCategory').value || null,
    ticketSupportRole: document.getElementById('cfg-supportRole').value || null,
    ticketTranscriptChannel: document.getElementById('cfg-transcriptChannel').value || null,
    ticketReviewChannel: document.getElementById('cfg-reviewChannel').value || null,
    ticketPublicReviewChannel: document.getElementById('cfg-publicReviewChannel').value || null,
    levelUpChannel: document.getElementById('cfg-levelChannel').value || null,
    suggestionChannel: document.getElementById('cfg-suggestionChannel').value || null,
    starboardChannel: document.getElementById('cfg-starboardChannel').value || null,
    xpMin: parseInt(document.getElementById('cfg-xpMin').value) || 15,
    xpMax: parseInt(document.getElementById('cfg-xpMax').value) || 25,
    xpCooldown: parseInt(document.getElementById('cfg-xpCooldown').value) || 60,
    levelUpMessage: document.getElementById('cfg-levelMsg').value || null,
    starboardThreshold: parseInt(document.getElementById('cfg-starboardThreshold').value) || 3
  };
  const res = await fetch('/api/guilds/' + guildId + '/config', { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
  if (res.ok) { showToast('Settings saved!', 'success'); config = await res.json(); }
  else showToast('Failed to save', 'error');
}

async function saveWelcome() {
  const data = { welcomeChannel: document.getElementById('welcome-channel').value || null, welcomeMessage: document.getElementById('welcome-message').value || null };
  const res = await fetch('/api/guilds/' + guildId + '/config', { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
  res.ok ? showToast('Welcome saved!', 'success') : showToast('Failed', 'error');
}

async function saveLeave() {
  const data = { leaveChannel: document.getElementById('leave-channel').value || null, leaveMessage: document.getElementById('leave-message').value || null };
  const res = await fetch('/api/guilds/' + guildId + '/config', { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
  res.ok ? showToast('Leave saved!', 'success') : showToast('Failed', 'error');
}

// Giveaways
async function loadGiveaways() {
  const res = await fetch('/api/guilds/' + guildId + '/giveaways');
  const giveaways = await res.json();
  const container = document.getElementById('giveaways-list');
  if (!giveaways.length) { container.innerHTML = '<div class="empty-state"><h3>No giveaways</h3><p>Create your first giveaway!</p></div>'; return; }
  container.innerHTML = giveaways.map(g => \`
    <div class="giveaway-card">
      <div class="giveaway-header">
        <div><div class="giveaway-prize">\${g.prize}</div><div class="giveaway-meta"><span>\${g.winners} winner(s)</span><span>\${(g.participants||[]).length} participants</span></div></div>
        <span class="badge badge-\${g.ended ? 'danger' : 'success'}">\${g.ended ? 'Ended' : 'Active'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>\${g.ended ? 'Ended' : 'Ends'}: \${new Date(g.endsAt).toLocaleString()}</div>
        <div style="display:flex;gap:8px">
          \${g.ended ? '<button class="btn btn-primary btn-sm" onclick="rerollGiveaway(' + g.id + ')">Reroll</button>' : ''}
          <button class="btn btn-danger btn-sm" onclick="deleteGiveaway(\${g.id})">Delete</button>
        </div>
      </div>
    </div>\`).join('');
}

function showGiveawayModal() {
  document.getElementById('modalContent').innerHTML = \`
    <h2>Create Giveaway</h2>
    <div class="form-group"><label>Channel</label><select id="giveaway-channel">\${channels.map(c => '<option value="' + c.id + '">#' + c.name + '</option>').join('')}</select></div>
    <div class="form-group"><label>Prize</label><input type="text" id="giveaway-prize" placeholder="What are you giving away?"></div>
    <div class="form-row"><div class="form-group"><label>Duration</label><select id="giveaway-duration"><option value="3600">1 hour</option><option value="21600">6 hours</option><option value="43200">12 hours</option><option value="86400">1 day</option><option value="259200">3 days</option><option value="604800">1 week</option></select></div><div class="form-group"><label>Winners</label><input type="number" id="giveaway-winners" value="1" min="1" max="10"></div></div>
    <div class="form-group"><label>Required Role (optional)</label><select id="giveaway-role"><option value="">None</option>\${roles.map(r => '<option value="' + r.id + '">' + r.name + '</option>').join('')}</select></div>
    <div class="modal-actions"><button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="createGiveaway()">Create</button></div>\`;
  document.getElementById('modal').classList.add('show');
}

async function createGiveaway() {
  const data = {
    channelId: document.getElementById('giveaway-channel').value,
    prize: document.getElementById('giveaway-prize').value,
    duration: parseInt(document.getElementById('giveaway-duration').value),
    winners: parseInt(document.getElementById('giveaway-winners').value),
    requiredRole: document.getElementById('giveaway-role').value || null
  };
  const res = await fetch('/api/guilds/' + guildId + '/giveaways', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
  if (res.ok) { showToast('Giveaway created!', 'success'); closeModal(); loadGiveaways(); }
  else showToast('Failed', 'error');
}

async function deleteGiveaway(id) { if (!confirm('Delete this giveaway?')) return; await fetch('/api/guilds/' + guildId + '/giveaways/' + id, { method: 'DELETE' }); loadGiveaways(); }
async function rerollGiveaway(id) { await fetch('/api/guilds/' + guildId + '/giveaways/' + id + '/reroll', { method: 'POST' }); showToast('Rerolled!', 'success'); }

// Reaction Roles
async function loadReactionRoles() {
  const res = await fetch('/api/guilds/' + guildId + '/reaction-roles');
  const rrs = await res.json();
  const container = document.getElementById('reaction-roles-list');
  if (!rrs.length) { container.innerHTML = '<div class="empty-state"><h3>No reaction roles</h3><p>Create your first reaction role panel!</p></div>'; return; }

  const grouped = {};
  rrs.forEach(r => { if (!grouped[r.messageId]) grouped[r.messageId] = []; grouped[r.messageId].push(r); });

  container.innerHTML = Object.entries(grouped).map(([msgId, items]) => \`
    <div class="card" style="margin-bottom: 16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="color:var(--text-muted);font-size:13px">Message: \${msgId}</span>
        <button class="btn btn-danger btn-sm" onclick="deleteReactionRoles('\${msgId}')">Delete</button>
      </div>
      <div>\${items.map(r => '<span class="role-chip"><span class="color" style="background:' + (roles.find(x=>x.id===r.roleId)?.color || '#99aab5') + '"></span>' + (roles.find(x=>x.id===r.roleId)?.name || 'Unknown') + '</span>').join('')}</div>
    </div>\`).join('');
}

function showReactionRoleModal() {
  document.getElementById('modalContent').innerHTML = \`
    <h2>Create Reaction Roles</h2>
    <div class="form-group"><label>Channel</label><select id="rr-channel">\${channels.map(c => '<option value="' + c.id + '">#' + c.name + '</option>').join('')}</select></div>
    <div class="form-group"><label>Title</label><input type="text" id="rr-title" value="Role Selection"></div>
    <div class="form-group"><label>Description</label><textarea id="rr-desc" rows="3">Select your roles below</textarea></div>
    <div class="form-group"><label>Color</label><input type="color" id="rr-color" value="#5865f2"></div>
    <div class="form-group"><label>Roles</label><div id="rr-roles-list"></div><button class="btn btn-secondary btn-sm" onclick="addRRRole()">+ Add Role</button></div>
    <div class="modal-actions"><button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="createReactionRoles()">Create</button></div>\`;
  document.getElementById('modal').classList.add('show');
  window.rrRoles = [];
  addRRRole();
}

function addRRRole() {
  window.rrRoles.push({ roleId: '', emoji: '', description: '' });
  document.getElementById('rr-roles-list').innerHTML = window.rrRoles.map((r, i) => \`
    <div style="display:flex;gap:8px;margin-bottom:8px">
      <select style="flex:2" onchange="window.rrRoles[\${i}].roleId=this.value;window.rrRoles[\${i}].name=this.options[this.selectedIndex].text">\${roles.map(x => '<option value="' + x.id + '"' + (x.id===r.roleId?' selected':'') + '>' + x.name + '</option>').join('')}</select>
      <input type="text" style="flex:1" placeholder="Emoji" value="\${r.emoji}" onchange="window.rrRoles[\${i}].emoji=this.value">
      <button class="btn btn-danger btn-icon" onclick="window.rrRoles.splice(\${i},1);addRRRole()">×</button>
    </div>\`).join('');
  if (window.rrRoles.length && !window.rrRoles[0].roleId) window.rrRoles[0].roleId = roles[0]?.id; window.rrRoles[0].name = roles[0]?.name;
}

async function createReactionRoles() {
  const data = {
    channelId: document.getElementById('rr-channel').value,
    title: document.getElementById('rr-title').value,
    description: document.getElementById('rr-desc').value,
    color: document.getElementById('rr-color').value,
    roles: window.rrRoles.filter(r => r.roleId)
  };
  const res = await fetch('/api/guilds/' + guildId + '/reaction-roles', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
  if (res.ok) { showToast('Reaction roles created!', 'success'); closeModal(); loadReactionRoles(); }
  else showToast('Failed', 'error');
}

async function deleteReactionRoles(msgId) { if (!confirm('Delete these reaction roles?')) return; await fetch('/api/guilds/' + guildId + '/reaction-roles/' + msgId, { method: 'DELETE' }); loadReactionRoles(); }

// Auto Roles
async function loadAutoRoles() {
  const res = await fetch('/api/guilds/' + guildId + '/auto-roles');
  const ars = await res.json();
  const container = document.getElementById('auto-roles-list');
  if (!ars.length) { container.innerHTML = '<div class="empty-state"><h3>No auto roles</h3><p>Add roles to automatically assign to new members.</p></div>'; return; }
  container.innerHTML = ars.map(ar => \`
    <div class="auto-role-item">
      <div style="display:flex;align-items:center;gap:12px">
        <span class="role-chip"><span class="color" style="background:\${roles.find(r=>r.id===ar.roleId)?.color || '#99aab5'}"></span>\${roles.find(r=>r.id===ar.roleId)?.name || 'Unknown'}</span>
        \${ar.delay ? '<span class="badge badge-primary">Delay: ' + ar.delay + 's</span>' : ''}
      </div>
      <button class="btn btn-danger btn-sm" onclick="deleteAutoRole(\${ar.id})">Remove</button>
    </div>\`).join('');
}

function showAutoRoleModal() {
  document.getElementById('modalContent').innerHTML = \`
    <h2>Add Auto Role</h2>
    <div class="form-group"><label>Role</label><select id="ar-role">\${roles.map(r => '<option value="' + r.id + '">' + r.name + '</option>').join('')}</select></div>
    <div class="form-group"><label>Delay (seconds, 0 = instant)</label><input type="number" id="ar-delay" value="0" min="0"></div>
    <div class="modal-actions"><button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="createAutoRole()">Add</button></div>\`;
  document.getElementById('modal').classList.add('show');
}

async function createAutoRole() {
  const res = await fetch('/api/guilds/' + guildId + '/auto-roles', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ roleId: document.getElementById('ar-role').value, delay: parseInt(document.getElementById('ar-delay').value) || 0 }) });
  if (res.ok) { showToast('Auto role added!', 'success'); closeModal(); loadAutoRoles(); }
  else showToast('Failed', 'error');
}

async function deleteAutoRole(id) { await fetch('/api/guilds/' + guildId + '/auto-roles/' + id, { method: 'DELETE' }); loadAutoRoles(); }

// Leaderboard
async function loadLeaderboard() {
  const res = await fetch('/api/guilds/' + guildId + '/leaderboard');
  const lb = await res.json();
  const container = document.getElementById('leaderboard-list');
  if (!lb.length) { container.innerHTML = '<div class="empty-state"><h3>No data</h3><p>Members will appear here as they earn XP.</p></div>'; return; }
  container.innerHTML = lb.map(u => \`
    <div class="leaderboard-item">
      <div class="leaderboard-rank \${u.rank <= 3 ? 'rank-' + u.rank : ''}">\${u.rank}</div>
      <div class="leaderboard-user">
        <img src="https://cdn.discordapp.com/avatars/\${u.id}/\${u.avatar}.png" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
        <span style="color:var(--text-primary)">\${u.username}</span>
      </div>
      <div class="leaderboard-xp"><div class="level">Level \${u.level}</div><div class="xp">\${u.xp.toLocaleString()} XP</div></div>
    </div>\`).join('');
}

// Warns
async function loadWarns() {
  const res = await fetch('/api/guilds/' + guildId + '/warns');
  const warns = await res.json();
  const container = document.getElementById('warns-list');
  if (!warns.length) { container.innerHTML = '<div class="empty-state"><h3>No warnings</h3><p>Members with warnings will appear here.</p></div>'; return; }
  container.innerHTML = warns.map(w => \`
    <div class="warn-item">
      <div class="warn-header">
        <div class="warn-user"><span style="color:var(--text-primary);font-weight:600">User: \${w.odbyUserId}</span></div>
        <button class="btn btn-danger btn-sm" onclick="deleteWarn(\${w.id})">Remove</button>
      </div>
      <div class="warn-reason">\${w.reason || 'No reason'}</div>
      <div class="warn-meta">By: \${w.odByModId} • \${new Date(w.timestamp).toLocaleString()}</div>
    </div>\`).join('');
}

async function deleteWarn(id) { if (!confirm('Remove this warning?')) return; await fetch('/api/guilds/' + guildId + '/warns/' + id, { method: 'DELETE' }); loadWarns(); }

// Logs
async function loadLogs() {
  const res = await fetch('/api/guilds/' + guildId + '/dashboard-logs');
  const logs = await res.json();
  const container = document.getElementById('logs-list');
  if (!logs.length) { container.innerHTML = '<div class="empty-state"><h3>No logs</h3></div>'; return; }
  container.innerHTML = logs.map(l => \`
    <div class="log-entry">
      <span class="log-time">\${new Date(l.timestamp).toLocaleString()}</span>
      <span class="log-action info">\${l.action}</span>
      <span class="log-details">\${l.details}</span>
    </div>\`).join('');
}

function addLogEntry(data) {
  const container = document.getElementById('logs-list');
  if (!container) return;
  const entry = document.createElement('div');
  entry.className = 'log-entry fade-in';
  entry.innerHTML = '<span class="log-time">' + new Date(data.timestamp).toLocaleString() + '</span><span class="log-action info">' + data.action + '</span><span class="log-details">' + data.details + '</span>';
  container.prepend(entry);
}

// Utils
function showToast(msg, type) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast ' + type + ' show';
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function closeModal() { document.getElementById('modal').classList.remove('show'); }
document.getElementById('modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

// Init
loadAll();
setInterval(loadStats, 30000);
`;
}
