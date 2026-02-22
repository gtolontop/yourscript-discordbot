import { useParams } from "react-router-dom";
import { Trash2, Plus } from "lucide-react";
import { useState } from "react";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import Card from "../components/Card";
import Table from "../components/Table";
import Badge from "../components/Badge";
import Loading from "../components/Loading";

export default function AutoRoles() {
  const { guildId } = useParams<{ guildId: string }>();
  const { data: autoRoles, loading, refetch } = useApi(
    () => api.getAutoRoles(guildId!),
    [guildId]
  );
  const { data: roles } = useApi(
    () => api.getGuildRoles(guildId!),
    [guildId]
  );

  const [newRoleId, setNewRoleId] = useState("");

  const handleAdd = async () => {
    if (!newRoleId) return;
    await api.createAutoRole(guildId!, { role_id: newRoleId });
    setNewRoleId("");
    refetch();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remove this auto role?")) return;
    await api.deleteAutoRole(guildId!, id);
    refetch();
  };

  const roleOptions = (roles ?? []).filter((r) => r.name !== "@everyone");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Auto Roles</h1>

      {/* Add Auto Role */}
      <Card title="Add Auto Role" className="mb-4">
        <div className="flex gap-2">
          <select
            value={newRoleId}
            onChange={(e) => setNewRoleId(e.target.value)}
            className="flex-1 bg-discord-dark border border-discord-border rounded-lg px-3 py-2 text-sm text-discord-text focus:outline-none focus:ring-2 focus:ring-discord-blurple/50"
          >
            <option value="">Select a role...</option>
            {roleOptions.map((r) => (
              <option key={r.id} value={r.id}>
                @{r.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            disabled={!newRoleId}
            className="flex items-center gap-2 bg-discord-blurple hover:bg-discord-blurple/80 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Add
          </button>
        </div>
      </Card>

      {/* Auto Roles List */}
      <Card title="Current Auto Roles">
        {loading ? (
          <Loading />
        ) : (
          <Table
            columns={[
              {
                key: "role",
                header: "Role",
                render: (r) => <span className="font-mono text-sm">{r.role_id}</span>,
              },
              {
                key: "type",
                header: "Type",
                render: (r) => <Badge variant="info">{r.role_type}</Badge>,
              },
              {
                key: "delay",
                header: "Delay",
                render: (r) => r.delay > 0 ? `${r.delay}s` : "Instant",
              },
              {
                key: "actions",
                header: "",
                render: (r) => (
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="text-discord-red hover:text-discord-red/80 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                ),
                className: "w-10",
              },
            ]}
            data={autoRoles ?? []}
            keyExtractor={(r) => r.id}
            emptyMessage="No auto roles configured."
          />
        )}
      </Card>
    </div>
  );
}
