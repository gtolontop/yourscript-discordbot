import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Layout from "./components/Layout";
import ServerSelect from "./pages/ServerSelect";
import Overview from "./pages/Overview";
import Config from "./pages/Config";
import Tickets from "./pages/Tickets";
import Moderation from "./pages/Moderation";
import Giveaways from "./pages/Giveaways";
import RoleMenus from "./pages/RoleMenus";
import AutoRoles from "./pages/AutoRoles";
import Leaderboard from "./pages/Leaderboard";
import EmbedBuilder from "./pages/EmbedBuilder";
import ActivityLogs from "./pages/ActivityLogs";
import { api, type User } from "./lib/api";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-discord-blurple" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="bg-discord-card p-8 rounded-xl text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4">Bot Dashboard</h1>
          <p className="text-discord-muted mb-6">
            Sign in with Discord to manage your servers.
          </p>
          <a
            href="/api/v1/auth/login"
            className="inline-block bg-discord-blurple hover:bg-discord-blurple/80 text-white font-medium px-6 py-3 rounded-lg transition-colors"
          >
            Sign in with Discord
          </a>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<ServerSelect user={user} />} />
      <Route path="/server/:guildId" element={<Layout user={user} />}>
        <Route index element={<Overview />} />
        <Route path="config" element={<Config />} />
        <Route path="tickets" element={<Tickets />} />
        <Route path="moderation" element={<Moderation />} />
        <Route path="giveaways" element={<Giveaways />} />
        <Route path="role-menus" element={<RoleMenus />} />
        <Route path="auto-roles" element={<AutoRoles />} />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="embed-builder" element={<EmbedBuilder />} />
        <Route path="logs" element={<ActivityLogs />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
