import { useParams } from "react-router-dom";
import { useState } from "react";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import Card from "../components/Card";
import Table from "../components/Table";
import Badge from "../components/Badge";
import Loading from "../components/Loading";

const statusOptions = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
];

export default function Tickets() {
  const { guildId } = useParams<{ guildId: string }>();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data, loading } = useApi(
    () => api.getTickets(guildId!, page, status || undefined),
    [guildId, page, status]
  );

  const statusBadge = (s: string) => {
    switch (s) {
      case "open":
        return <Badge variant="success">Open</Badge>;
      case "closed":
        return <Badge variant="danger">Closed</Badge>;
      default:
        return <Badge>{s}</Badge>;
    }
  };

  const priorityBadge = (p: string) => {
    switch (p) {
      case "urgent":
        return <Badge variant="danger">Urgent</Badge>;
      case "high":
        return <Badge variant="warning">High</Badge>;
      case "normal":
        return <Badge variant="info">Normal</Badge>;
      case "low":
        return <Badge>Low</Badge>;
      default:
        return <Badge>{p}</Badge>;
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Tickets</h1>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {statusOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => { setStatus(opt.value); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              status === opt.value
                ? "bg-discord-blurple text-white"
                : "bg-discord-card text-discord-muted hover:text-discord-text"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <Card>
        {loading ? (
          <Loading />
        ) : (
          <>
            <Table
              columns={[
                {
                  key: "number",
                  header: "#",
                  render: (t) => <span className="font-mono">#{t.number}</span>,
                },
                {
                  key: "subject",
                  header: "Subject",
                  render: (t) => t.subject ?? t.category ?? "No subject",
                },
                {
                  key: "user_id",
                  header: "User",
                  render: (t) => <span className="font-mono text-xs">{t.user_id}</span>,
                },
                {
                  key: "status",
                  header: "Status",
                  render: (t) => statusBadge(t.status),
                },
                {
                  key: "priority",
                  header: "Priority",
                  render: (t) => priorityBadge(t.priority),
                },
                {
                  key: "created_at",
                  header: "Created",
                  render: (t) => new Date(t.created_at).toLocaleDateString(),
                },
              ]}
              data={data?.tickets ?? []}
              keyExtractor={(t) => t.id}
              emptyMessage="No tickets found."
            />

            {/* Pagination */}
            {data && data.total > 20 && (
              <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-discord-border">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 rounded bg-discord-dark text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-discord-muted">
                  Page {page} of {Math.ceil(data.total / 20)}
                </span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= Math.ceil(data.total / 20)}
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
