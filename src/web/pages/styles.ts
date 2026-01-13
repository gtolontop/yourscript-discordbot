export const baseStyles = `
:root {
  --bg-primary: #111111;
  --bg-secondary: #191919;
  --bg-tertiary: #0a0a0a;
  --bg-card: #1a1a1a;
  --bg-hover: #252525;
  --accent: #ffffff;
  --accent-hover: #e0e0e0;
  --success: #22c55e;
  --danger: #ef4444;
  --warning: #eab308;
  --text-primary: #ffffff;
  --text-secondary: #a1a1a1;
  --text-muted: #6b6b6b;
  --border: #2a2a2a;
  --shadow: rgba(0,0,0,0.5);
}

* { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  font-family: 'Inter', 'Segoe UI', sans-serif;
  background: var(--bg-primary);
  color: var(--text-secondary);
  line-height: 1.6;
  min-height: 100vh;
}

a { color: var(--accent); text-decoration: none; transition: all 0.2s; }
a:hover { color: var(--accent-hover); }

.btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 20px; border-radius: 8px; font-weight: 600;
  cursor: pointer; border: none; transition: all 0.2s;
  font-size: 14px; text-decoration: none;
}
.btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px var(--shadow); }
.btn-primary { background: var(--accent); color: #000; }
.btn-primary:hover { background: var(--accent-hover); color: #000; }
.btn-success { background: var(--success); color: #000; }
.btn-danger { background: var(--danger); color: #fff; }
.btn-secondary { background: var(--bg-hover); color: var(--text-primary); }
.btn-sm { padding: 6px 12px; font-size: 12px; }
.btn-icon { padding: 8px; border-radius: 6px; }

.card {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 24px;
  border: 1px solid var(--border);
  transition: all 0.2s;
}
.card:hover { border-color: var(--accent); }
.card h2 { font-size: 18px; color: var(--text-primary); margin-bottom: 16px; font-weight: 600; }
.card h3 { font-size: 14px; color: var(--text-primary); margin-bottom: 12px; font-weight: 600; }

.grid { display: grid; gap: 16px; }
.grid-2 { grid-template-columns: repeat(2, 1fr); }
.grid-3 { grid-template-columns: repeat(3, 1fr); }
.grid-4 { grid-template-columns: repeat(4, 1fr); }
.grid-6 { grid-template-columns: repeat(6, 1fr); }

.stat-card {
  background: var(--bg-card);
  border-radius: 12px; padding: 20px; text-align: center;
  border: 1px solid var(--border); position: relative; overflow: hidden;
}
.stat-card::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: var(--border);
}
.stat-value { font-size: 36px; font-weight: 700; color: var(--text-primary); }
.stat-label { font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }
.stat-icon { font-size: 24px; margin-bottom: 8px; }

.form-group { margin-bottom: 20px; }
.form-group label {
  display: block; font-size: 12px; color: var(--text-secondary);
  margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;
}
.form-group input, .form-group select, .form-group textarea {
  width: 100%; padding: 12px 16px; background: var(--bg-tertiary);
  border: 1px solid var(--border); border-radius: 8px;
  color: var(--text-primary); font-size: 14px; transition: all 0.2s;
}
.form-group input:focus, .form-group select:focus, .form-group textarea:focus {
  outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(88,101,242,0.2);
}
.form-group input::placeholder, .form-group textarea::placeholder { color: var(--text-muted); }
.form-row { display: flex; gap: 16px; }
.form-row .form-group { flex: 1; }

.toggle-switch {
  position: relative; width: 48px; height: 24px;
}
.toggle-switch input { opacity: 0; width: 0; height: 0; }
.toggle-slider {
  position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
  background: var(--bg-tertiary); border-radius: 24px; transition: 0.3s;
}
.toggle-slider::before {
  content: ''; position: absolute; height: 18px; width: 18px; left: 3px; bottom: 3px;
  background: var(--text-secondary); border-radius: 50%; transition: 0.3s;
}
input:checked + .toggle-slider { background: var(--accent); }
input:checked + .toggle-slider::before { transform: translateX(24px); background: white; }

.toast {
  position: fixed; bottom: 24px; right: 24px; padding: 16px 24px;
  border-radius: 8px; color: #fff; transform: translateY(100px); opacity: 0;
  transition: all 0.3s; z-index: 10000; font-weight: 500;
  box-shadow: 0 4px 20px var(--shadow);
}
.toast.show { transform: translateY(0); opacity: 1; }
.toast.success { background: var(--success); color: #000; }
.toast.error { background: var(--danger); }

.badge {
  display: inline-flex; align-items: center; padding: 4px 10px;
  border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase;
}
.badge-success { background: rgba(87,242,135,0.2); color: var(--success); }
.badge-danger { background: rgba(237,66,69,0.2); color: var(--danger); }
.badge-warning { background: rgba(254,231,92,0.2); color: var(--warning); }
.badge-primary { background: rgba(255,255,255,0.1); color: var(--text-primary); }

.table { width: 100%; border-collapse: collapse; }
.table th, .table td { padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--border); }
.table th { font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 600; }
.table tr:hover { background: var(--bg-hover); }

.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.8);
  display: none; align-items: center; justify-content: center; z-index: 9999;
}
.modal-overlay.show { display: flex; }
.modal {
  background: var(--bg-card); border-radius: 12px; padding: 24px;
  max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;
  border: 1px solid var(--border);
}
.modal h2 { margin-bottom: 20px; }
.modal-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px; }

.tabs { display: flex; gap: 4px; margin-bottom: 24px; border-bottom: 1px solid var(--border); padding-bottom: 4px; }
.tab {
  padding: 12px 20px; color: var(--text-muted); cursor: pointer;
  border-radius: 8px 8px 0 0; transition: all 0.2s; font-weight: 500;
}
.tab:hover { color: var(--text-primary); background: var(--bg-hover); }
.tab.active { color: var(--text-primary); background: var(--bg-hover); border-bottom: 2px solid var(--text-primary); }

.empty-state {
  text-align: center; padding: 60px 20px; color: var(--text-muted);
}
.empty-state svg { width: 80px; height: 80px; margin-bottom: 16px; opacity: 0.5; }
.empty-state h3 { color: var(--text-primary); margin-bottom: 8px; }

.loading { display: flex; align-items: center; justify-content: center; padding: 40px; }
.spinner {
  width: 40px; height: 40px; border: 3px solid var(--border);
  border-top-color: var(--accent); border-radius: 50%; animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.search-box {
  position: relative; max-width: 300px;
}
.search-box input {
  padding-left: 40px;
}
.search-box svg {
  position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
  width: 18px; height: 18px; color: var(--text-muted);
}

.dropdown {
  position: relative; display: inline-block;
}
.dropdown-menu {
  position: absolute; top: 100%; right: 0; min-width: 180px;
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: 8px; padding: 8px 0; display: none; z-index: 100;
  box-shadow: 0 8px 24px var(--shadow);
}
.dropdown-menu.show { display: block; }
.dropdown-item {
  display: flex; align-items: center; gap: 10px; padding: 10px 16px;
  color: var(--text-secondary); cursor: pointer; transition: all 0.2s;
}
.dropdown-item:hover { background: var(--bg-hover); color: var(--text-primary); }

.progress-bar {
  height: 8px; background: var(--bg-tertiary); border-radius: 4px; overflow: hidden;
}
.progress-fill {
  height: 100%; background: var(--text-secondary);
  border-radius: 4px; transition: width 0.5s ease;
}

@media (max-width: 1200px) { .grid-6 { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 992px) { .grid-4 { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 768px) {
  .grid-2, .grid-3, .grid-4, .grid-6 { grid-template-columns: 1fr; }
  .form-row { flex-direction: column; }
  .sidebar { transform: translateX(-100%); }
  .sidebar.open { transform: translateX(0); }
  .main { margin-left: 0 !important; }
}

.fade-in { animation: fadeIn 0.3s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

.scrollbar::-webkit-scrollbar { width: 6px; }
.scrollbar::-webkit-scrollbar-track { background: var(--bg-tertiary); }
.scrollbar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
.scrollbar::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
`;
