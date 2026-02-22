import { Outlet, NavLink, useParams, useNavigate } from "react-router-dom";
import type { User } from "../lib/api";
import {
  LayoutDashboard,
  Settings,
  Ticket,
  Shield,
  Gift,
  Tags,
  UserPlus,
  Trophy,
  Code,
  ScrollText,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { path: "", label: "Overview", icon: LayoutDashboard },
  { path: "config", label: "Configuration", icon: Settings },
  { path: "tickets", label: "Tickets", icon: Ticket },
  { path: "moderation", label: "Moderation", icon: Shield },
  { path: "giveaways", label: "Giveaways", icon: Gift },
  { path: "role-menus", label: "Role Menus", icon: Tags },
  { path: "auto-roles", label: "Auto Roles", icon: UserPlus },
  { path: "leaderboard", label: "Leaderboard", icon: Trophy },
  { path: "embed-builder", label: "Embed Builder", icon: Code },
  { path: "logs", label: "Activity Logs", icon: ScrollText },
];

export default function Layout({ user }: { user: User }) {
  const { guildId } = useParams();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
    : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.id) % 5}.png`;

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-discord-dark border-r border-discord-border flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-discord-border">
          <button
            onClick={() => navigate("/")}
            className="text-lg font-bold hover:text-discord-blurple transition-colors"
          >
            Bot Dashboard
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={`/server/${guildId}/${item.path}`}
              end={item.path === ""}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-discord-blurple/20 text-discord-blurple"
                    : "text-discord-muted hover:bg-discord-card hover:text-discord-text"
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User Section */}
        <div className="p-3 border-t border-discord-border relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-discord-card transition-colors"
          >
            <img
              src={avatarUrl}
              alt={user.username}
              className="w-8 h-8 rounded-full"
            />
            <span className="flex-1 text-left text-sm font-medium truncate">
              {user.username}
            </span>
            <ChevronDown size={16} className="text-discord-muted" />
          </button>

          {userMenuOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-1 bg-discord-card border border-discord-border rounded-lg overflow-hidden shadow-xl">
              <a
                href="/api/v1/auth/logout"
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-discord-red hover:bg-discord-dark transition-colors"
              >
                <LogOut size={16} />
                Sign Out
              </a>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-discord-darker p-6">
        <Outlet />
      </main>
    </div>
  );
}
