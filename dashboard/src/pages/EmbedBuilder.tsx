import { useState } from "react";
import { useParams } from "react-router-dom";
import { Send } from "lucide-react";
import Card from "../components/Card";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";

interface EmbedData {
  title: string;
  description: string;
  color: string;
  footer: string;
  image: string;
  thumbnail: string;
}

export default function EmbedBuilder() {
  const { guildId } = useParams<{ guildId: string }>();
  const { data: channels } = useApi(
    () => api.getGuildChannels(guildId!),
    [guildId]
  );

  const [embed, setEmbed] = useState<EmbedData>({
    title: "",
    description: "",
    color: "#5865F2",
    footer: "",
    image: "",
    thumbnail: "",
  });
  const [channelId, setChannelId] = useState("");

  const textChannels = (channels ?? [])
    .filter((c) => c.type === 0)
    .map((c) => ({ value: c.id, label: `#${c.name}` }));

  const update = (key: keyof EmbedData, value: string) => {
    setEmbed((prev) => ({ ...prev, [key]: value }));
  };

  const colorInt = parseInt(embed.color.replace("#", ""), 16) || 0x5865f2;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Embed Builder</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor */}
        <Card title="Editor">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Title</label>
              <input
                type="text"
                value={embed.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="Embed title"
                className="w-full bg-discord-dark border border-discord-border rounded-lg px-3 py-2 text-sm text-discord-text focus:outline-none focus:ring-2 focus:ring-discord-blurple/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Description
              </label>
              <textarea
                value={embed.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="Embed description..."
                rows={5}
                className="w-full bg-discord-dark border border-discord-border rounded-lg px-3 py-2 text-sm text-discord-text focus:outline-none focus:ring-2 focus:ring-discord-blurple/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={embed.color}
                    onChange={(e) => update("color", e.target.value)}
                    className="w-10 h-10 rounded border border-discord-border cursor-pointer"
                  />
                  <input
                    type="text"
                    value={embed.color}
                    onChange={(e) => update("color", e.target.value)}
                    className="flex-1 bg-discord-dark border border-discord-border rounded-lg px-3 py-2 text-sm text-discord-text focus:outline-none focus:ring-2 focus:ring-discord-blurple/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Footer</label>
                <input
                  type="text"
                  value={embed.footer}
                  onChange={(e) => update("footer", e.target.value)}
                  placeholder="Footer text"
                  className="w-full bg-discord-dark border border-discord-border rounded-lg px-3 py-2 text-sm text-discord-text focus:outline-none focus:ring-2 focus:ring-discord-blurple/50"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Image URL</label>
              <input
                type="text"
                value={embed.image}
                onChange={(e) => update("image", e.target.value)}
                placeholder="https://..."
                className="w-full bg-discord-dark border border-discord-border rounded-lg px-3 py-2 text-sm text-discord-text focus:outline-none focus:ring-2 focus:ring-discord-blurple/50"
              />
            </div>
          </div>
        </Card>

        {/* Preview */}
        <div className="space-y-4">
          <Card title="Preview">
            <div
              className="rounded-lg p-4 border-l-4"
              style={{ borderColor: embed.color, backgroundColor: "#2f3136" }}
            >
              {embed.title && (
                <h3 className="font-semibold mb-1">{embed.title}</h3>
              )}
              {embed.description && (
                <p className="text-sm text-discord-muted whitespace-pre-wrap">
                  {embed.description}
                </p>
              )}
              {embed.image && (
                <img
                  src={embed.image}
                  alt="Embed"
                  className="mt-3 max-w-full rounded"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              {embed.footer && (
                <p className="text-xs text-discord-muted mt-3 pt-2 border-t border-discord-border">
                  {embed.footer}
                </p>
              )}
            </div>
          </Card>

          {/* Send */}
          <Card title="Send">
            <div className="flex gap-2">
              <select
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                className="flex-1 bg-discord-dark border border-discord-border rounded-lg px-3 py-2 text-sm text-discord-text focus:outline-none focus:ring-2 focus:ring-discord-blurple/50"
              >
                <option value="">Select a channel...</option>
                {textChannels.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <button
                disabled={!channelId || !embed.title}
                className="flex items-center gap-2 bg-discord-blurple hover:bg-discord-blurple/80 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Send size={16} />
                Send
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
