import { useParams } from "react-router-dom";
import { useState } from "react";
import { Trophy } from "lucide-react";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import Card from "../components/Card";
import Loading from "../components/Loading";

export default function Leaderboard() {
  const { guildId } = useParams<{ guildId: string }>();
  const [page, setPage] = useState(1);

  const { data, loading } = useApi(
    () => api.getLeaderboard(guildId!, page),
    [guildId, page]
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Leaderboard</h1>

      <Card>
        {loading ? (
          <Loading />
        ) : (
          <>
            <div className="space-y-2">
              {(data?.items ?? []).map((entry, index) => {
                const rank = (page - 1) * 20 + index + 1;
                const medal =
                  rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;

                return (
                  <div
                    key={entry.user_id}
                    className="flex items-center gap-4 bg-discord-dark rounded-lg px-4 py-3"
                  >
                    <span className="text-lg font-bold w-8 text-center">
                      {medal ?? `#${rank}`}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium font-mono text-sm">{entry.user_id}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-discord-blurple">Level {entry.level}</p>
                      <p className="text-xs text-discord-muted">{entry.xp.toLocaleString()} XP</p>
                    </div>
                  </div>
                );
              })}

              {(data?.items ?? []).length === 0 && (
                <div className="text-center py-8 text-discord-muted">
                  <Trophy size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No one on the leaderboard yet.</p>
                </div>
              )}
            </div>

            {data && data.total > 20 && (
              <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-discord-border">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 rounded bg-discord-card text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-discord-muted">
                  Page {page} of {Math.ceil(data.total / 20)}
                </span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= Math.ceil(data.total / 20)}
                  className="px-3 py-1 rounded bg-discord-card text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
