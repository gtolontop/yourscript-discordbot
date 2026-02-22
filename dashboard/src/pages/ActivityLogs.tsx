import { useParams } from "react-router-dom";
import { useState } from "react";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import Card from "../components/Card";
import Table from "../components/Table";
import Loading from "../components/Loading";

export default function ActivityLogs() {
  const { guildId } = useParams<{ guildId: string }>();
  const [page, setPage] = useState(1);

  const { data, loading } = useApi(
    () => api.getLogs(guildId!, page),
    [guildId, page]
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Activity Logs</h1>

      <Card>
        {loading ? (
          <Loading />
        ) : (
          <>
            <Table
              columns={[
                {
                  key: "action",
                  header: "Action",
                  render: (l) => <span className="font-medium">{l.action}</span>,
                },
                {
                  key: "user",
                  header: "User",
                  render: (l) => <span className="font-mono text-xs">{l.user_id}</span>,
                },
                {
                  key: "details",
                  header: "Details",
                  render: (l) => (
                    <span className="text-discord-muted truncate max-w-[300px] block">
                      {l.details ?? "—"}
                    </span>
                  ),
                },
                {
                  key: "timestamp",
                  header: "Time",
                  render: (l) => new Date(l.created_at).toLocaleString(),
                },
              ]}
              data={data?.logs ?? []}
              keyExtractor={(l) => l.id}
              emptyMessage="No logs found."
            />

            {data && data.total > 50 && (
              <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-discord-border">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 rounded bg-discord-dark text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-discord-muted">Page {page}</span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={(data?.logs ?? []).length < 50}
                  className="px-3 py-1 rounded bg-discord-dark text-sm disabled:opacity-50"
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
