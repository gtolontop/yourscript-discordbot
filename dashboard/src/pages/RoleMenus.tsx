import { useParams } from "react-router-dom";
import { api, type ReactionRole } from "../lib/api";
import { useApi } from "../hooks/useApi";
import Card from "../components/Card";
import Loading from "../components/Loading";

export default function RoleMenus() {
  const { guildId } = useParams<{ guildId: string }>();
  const { data: roles, loading } = useApi(
    () => api.getReactionRoles(guildId!),
    [guildId]
  );

  if (loading) return <Loading />;

  // Group by message
  const grouped = (roles ?? []).reduce<Record<string, ReactionRole[]>>((acc, r) => {
    if (!acc[r.message_id]) acc[r.message_id] = [];
    acc[r.message_id].push(r);
    return acc;
  }, {});

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Role Menus</h1>

      {Object.keys(grouped).length === 0 ? (
        <Card>
          <p className="text-center text-discord-muted py-8">
            No role menus configured. Use <code>/role-menu create</code> to add one.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([messageId, items]) => (
            <Card key={messageId} title={`Message: ${messageId}`} description={`Channel: ${items[0].channel_id}`}>
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 bg-discord-dark rounded-lg px-3 py-2"
                  >
                    <span className="text-lg">{item.emoji}</span>
                    <span className="font-mono text-sm">{item.role_id}</span>
                    {item.label && (
                      <span className="text-sm text-discord-muted">
                        ({item.label})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
