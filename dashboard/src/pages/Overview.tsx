import { useParams } from "react-router-dom";
import { Users, Ticket, Shield, Gift, MessageSquare, Trophy } from "lucide-react";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import StatCard from "../components/StatCard";
import Card from "../components/Card";
import Loading from "../components/Loading";

export default function Overview() {
  const { guildId } = useParams<{ guildId: string }>();
  const { data: stats, loading } = useApi(
    () => api.getGuildStats(guildId!),
    [guildId]
  );

  if (loading || !stats) return <Loading />;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Overview</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Members"
          value={stats.member_count}
          icon={Users}
          color="text-discord-blurple"
        />
        <StatCard
          label="Open Tickets"
          value={stats.ticket_count}
          icon={Ticket}
          color="text-discord-green"
        />
        <StatCard
          label="Active Warns"
          value={stats.warn_count}
          icon={Shield}
          color="text-discord-yellow"
        />
        <StatCard
          label="Active Giveaways"
          value={stats.active_giveaways}
          icon={Gift}
          color="text-discord-fuchsia"
        />
        <StatCard
          label="Suggestions"
          value={stats.suggestion_count}
          icon={MessageSquare}
          color="text-discord-red"
        />
        <StatCard
          label="Online Members"
          value={stats.online_count}
          icon={Trophy}
          color="text-discord-green"
        />
      </div>

      {/* Quick Actions */}
      <Card title="Quick Actions">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <a
            href={`/server/${guildId}/config`}
            className="bg-discord-dark hover:bg-discord-border/50 rounded-lg p-3 text-center text-sm transition-colors"
          >
            Configuration
          </a>
          <a
            href={`/server/${guildId}/tickets`}
            className="bg-discord-dark hover:bg-discord-border/50 rounded-lg p-3 text-center text-sm transition-colors"
          >
            View Tickets
          </a>
          <a
            href={`/server/${guildId}/moderation`}
            className="bg-discord-dark hover:bg-discord-border/50 rounded-lg p-3 text-center text-sm transition-colors"
          >
            Moderation
          </a>
          <a
            href={`/server/${guildId}/leaderboard`}
            className="bg-discord-dark hover:bg-discord-border/50 rounded-lg p-3 text-center text-sm transition-colors"
          >
            Leaderboard
          </a>
        </div>
      </Card>
    </div>
  );
}
