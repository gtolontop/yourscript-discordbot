import { useParams } from "react-router-dom";
import { useState } from "react";
import { Search, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import Card from "../components/Card";
import Table from "../components/Table";
import Loading from "../components/Loading";

export default function Moderation() {
  const { guildId } = useParams<{ guildId: string }>();
  const [searchUserId, setSearchUserId] = useState("");
  const [activeSearch, setActiveSearch] = useState<string | undefined>();

  const { data: warns, loading, refetch } = useApi(
    () => api.getWarns(guildId!, activeSearch),
    [guildId, activeSearch]
  );

  const handleSearch = () => {
    setActiveSearch(searchUserId || undefined);
  };

  const handleDelete = async (warnId: number) => {
    if (!confirm("Delete this warning?")) return;
    await api.deleteWarn(guildId!, warnId);
    refetch();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Moderation</h1>

      {/* Search */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-discord-muted" />
          <input
            type="text"
            value={searchUserId}
            onChange={(e) => setSearchUserId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search by User ID..."
            className="w-full bg-discord-card border border-discord-border rounded-lg pl-9 pr-3 py-2 text-sm text-discord-text focus:outline-none focus:ring-2 focus:ring-discord-blurple/50"
          />
        </div>
        <button
          onClick={handleSearch}
          className="bg-discord-blurple hover:bg-discord-blurple/80 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Search
        </button>
        {activeSearch && (
          <button
            onClick={() => { setSearchUserId(""); setActiveSearch(undefined); }}
            className="bg-discord-card hover:bg-discord-border text-discord-muted px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <Card title={`Warnings${activeSearch ? ` for ${activeSearch}` : ""}`}>
        {loading ? (
          <Loading />
        ) : (
          <Table
            columns={[
              {
                key: "id",
                header: "ID",
                render: (w) => <span className="font-mono">#{w.id}</span>,
              },
              {
                key: "target",
                header: "User",
                render: (w) => <span className="font-mono text-xs">{w.target_user_id}</span>,
              },
              {
                key: "moderator",
                header: "Moderator",
                render: (w) => <span className="font-mono text-xs">{w.moderator_id}</span>,
              },
              {
                key: "reason",
                header: "Reason",
                render: (w) => <span className="truncate max-w-[200px] block">{w.reason}</span>,
              },
              {
                key: "created_at",
                header: "Date",
                render: (w) => new Date(w.created_at).toLocaleDateString(),
              },
              {
                key: "actions",
                header: "",
                render: (w) => (
                  <button
                    onClick={() => handleDelete(w.id)}
                    className="text-discord-red hover:text-discord-red/80 transition-colors"
                    title="Delete warning"
                  >
                    <Trash2 size={16} />
                  </button>
                ),
                className: "w-10",
              },
            ]}
            data={warns ?? []}
            keyExtractor={(w) => w.id}
            emptyMessage="No warnings found."
          />
        )}
      </Card>
    </div>
  );
}
