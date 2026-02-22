import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import Card from "../components/Card";
import Table from "../components/Table";
import Badge from "../components/Badge";
import Loading from "../components/Loading";

export default function Giveaways() {
  const { guildId } = useParams<{ guildId: string }>();
  const { data: giveaways, loading } = useApi(
    () => api.getGiveaways(guildId!),
    [guildId]
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Giveaways</h1>
      <Card>
        {loading ? (
          <Loading />
        ) : (
          <Table
            columns={[
              { key: "id", header: "ID", render: (g) => <span className="font-mono">#{g.id}</span> },
              { key: "prize", header: "Prize", render: (g) => g.prize },
              {
                key: "winners",
                header: "Winners",
                render: (g) => g.winners.toString(),
              },
              {
                key: "participants",
                header: "Entries",
                render: (g) => {
                  const p = g.participants ? g.participants.split(",").filter(Boolean).length : 0;
                  return p.toString();
                },
              },
              {
                key: "status",
                header: "Status",
                render: (g) =>
                  g.ended ? (
                    <Badge variant="danger">Ended</Badge>
                  ) : (
                    <Badge variant="success">Active</Badge>
                  ),
              },
              {
                key: "ends_at",
                header: "Ends",
                render: (g) => {
                  const d = new Date(g.ends_at);
                  return g.ended ? "Ended" : d.toLocaleString();
                },
              },
            ]}
            data={giveaways ?? []}
            keyExtractor={(g) => g.id}
            emptyMessage="No giveaways found."
          />
        )}
      </Card>
    </div>
  );
}
