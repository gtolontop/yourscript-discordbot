import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Guild, type User } from "../lib/api";
import Loading from "../components/Loading";

export default function ServerSelect({ user }: { user: User }) {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .getGuilds()
      .then(setGuilds)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading message="Fetching your servers..." />;

  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
    : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.id) % 5}.png`;

  return (
    <div className="min-h-screen bg-discord-darker p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Select a Server</h1>
            <p className="text-discord-muted mt-1">
              Choose a server to manage
            </p>
          </div>
          <div className="flex items-center gap-3">
            <img
              src={avatarUrl}
              alt={user.username}
              className="w-8 h-8 rounded-full"
            />
            <span className="text-sm font-medium">{user.username}</span>
          </div>
        </div>

        {/* Guild Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {guilds.map((guild) => {
            const iconUrl = guild.icon
              ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`
              : null;

            return (
              <button
                key={guild.id}
                onClick={() => navigate(`/server/${guild.id}`)}
                className="bg-discord-card border border-discord-border rounded-xl p-4 flex items-center gap-4 hover:border-discord-blurple transition-colors text-left"
              >
                {iconUrl ? (
                  <img
                    src={iconUrl}
                    alt={guild.name}
                    className="w-12 h-12 rounded-full"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-discord-dark flex items-center justify-center text-lg font-bold">
                    {guild.name[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{guild.name}</p>
                  <p className="text-xs text-discord-muted">ID: {guild.id}</p>
                </div>
              </button>
            );
          })}
        </div>

        {guilds.length === 0 && (
          <div className="text-center py-12 text-discord-muted">
            <p>No servers found. Make sure you have admin permissions.</p>
          </div>
        )}
      </div>
    </div>
  );
}
