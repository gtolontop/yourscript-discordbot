import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { Save, RefreshCw } from "lucide-react";
import { api, type GuildConfig, type DiscordChannel, type DiscordRole } from "../lib/api";
import { useApi } from "../hooks/useApi";
import Card from "../components/Card";
import Toggle from "../components/Toggle";
import Select from "../components/Select";
import Loading from "../components/Loading";

export default function Config() {
  const { guildId } = useParams<{ guildId: string }>();
  const { data: config, loading, refetch } = useApi(
    () => api.getGuildConfig(guildId!),
    [guildId]
  );
  const { data: channels } = useApi(
    () => api.getGuildChannels(guildId!),
    [guildId]
  );
  const { data: roles } = useApi(
    () => api.getGuildRoles(guildId!),
    [guildId]
  );

  const [form, setForm] = useState<Partial<GuildConfig>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (config) setForm(config);
  }, [config]);

  if (loading || !config) return <Loading />;

  const textChannels = (channels ?? [])
    .filter((c) => c.type === 0)
    .map((c) => ({ value: c.id, label: `#${c.name}` }));

  const voiceChannels = (channels ?? [])
    .filter((c) => c.type === 2)
    .map((c) => ({ value: c.id, label: `🔊 ${c.name}` }));

  const roleOptions = (roles ?? [])
    .filter((r) => r.name !== "@everyone")
    .map((r) => ({ value: r.id, label: `@${r.name}` }));

  const update = (key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.updateGuildConfig(guildId!, form);
      setSaved(true);
      refetch();
    } catch (error) {
      console.error("Failed to save config:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Configuration</h1>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 bg-discord-blurple hover:bg-discord-blurple/80 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
          {saved ? "Saved!" : "Save Changes"}
        </button>
      </div>

      <div className="space-y-6">
        {/* Welcome */}
        <Card title="Welcome Messages" description="Configure welcome messages for new members">
          <div className="space-y-4">
            <Select
              label="Welcome Channel"
              value={form.welcome_channel ?? ""}
              options={textChannels}
              onChange={(v) => update("welcome_channel", v || null)}
              placeholder="Disabled"
            />
            <div>
              <label className="block text-sm font-medium mb-1.5">Welcome Message</label>
              <textarea
                value={form.welcome_message ?? ""}
                onChange={(e) => update("welcome_message", e.target.value || null)}
                placeholder="Welcome {user} to {server}!"
                className="w-full bg-discord-dark border border-discord-border rounded-lg px-3 py-2 text-sm text-discord-text focus:outline-none focus:ring-2 focus:ring-discord-blurple/50 min-h-[80px]"
              />
              <p className="text-xs text-discord-muted mt-1">
                Variables: {"{user}"}, {"{username}"}, {"{tag}"}, {"{server}"}, {"{memberCount}"}
              </p>
            </div>
          </div>
        </Card>

        {/* Leave */}
        <Card title="Leave Messages">
          <div className="space-y-4">
            <Select
              label="Leave Channel"
              value={form.leave_channel ?? ""}
              options={textChannels}
              onChange={(v) => update("leave_channel", v || null)}
              placeholder="Disabled"
            />
            <div>
              <label className="block text-sm font-medium mb-1.5">Leave Message</label>
              <textarea
                value={form.leave_message ?? ""}
                onChange={(e) => update("leave_message", e.target.value || null)}
                placeholder="{username} has left the server."
                className="w-full bg-discord-dark border border-discord-border rounded-lg px-3 py-2 text-sm text-discord-text focus:outline-none focus:ring-2 focus:ring-discord-blurple/50 min-h-[80px]"
              />
            </div>
          </div>
        </Card>

        {/* XP / Leveling */}
        <Card title="XP & Leveling" description="Configure the XP and leveling system">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Min XP per message</label>
              <input
                type="number"
                value={form.xp_min ?? 5}
                onChange={(e) => update("xp_min", parseInt(e.target.value))}
                className="w-full bg-discord-dark border border-discord-border rounded-lg px-3 py-2 text-sm text-discord-text focus:outline-none focus:ring-2 focus:ring-discord-blurple/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Max XP per message</label>
              <input
                type="number"
                value={form.xp_max ?? 15}
                onChange={(e) => update("xp_max", parseInt(e.target.value))}
                className="w-full bg-discord-dark border border-discord-border rounded-lg px-3 py-2 text-sm text-discord-text focus:outline-none focus:ring-2 focus:ring-discord-blurple/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Cooldown (seconds)</label>
              <input
                type="number"
                value={form.xp_cooldown ?? 60}
                onChange={(e) => update("xp_cooldown", parseInt(e.target.value))}
                className="w-full bg-discord-dark border border-discord-border rounded-lg px-3 py-2 text-sm text-discord-text focus:outline-none focus:ring-2 focus:ring-discord-blurple/50"
              />
            </div>
          </div>
          <Select
            label="Level Up Channel"
            value={form.level_up_channel ?? ""}
            options={textChannels}
            onChange={(v) => update("level_up_channel", v || null)}
            placeholder="Same channel"
          />
        </Card>

        {/* Tickets */}
        <Card title="Ticket System">
          <div className="space-y-4">
            <Select
              label="Support Role"
              value={form.ticket_support_role ?? ""}
              options={roleOptions}
              onChange={(v) => update("ticket_support_role", v || null)}
              placeholder="None"
            />
            <Select
              label="Transcript Channel"
              value={form.ticket_transcript_channel ?? ""}
              options={textChannels}
              onChange={(v) => update("ticket_transcript_channel", v || null)}
              placeholder="None"
            />
            <Select
              label="Review Channel"
              value={form.ticket_review_channel ?? ""}
              options={textChannels}
              onChange={(v) => update("ticket_review_channel", v || null)}
              placeholder="None"
            />
          </div>
        </Card>

        {/* Suggestions */}
        <Card title="Suggestions">
          <div className="space-y-4">
            <Select
              label="Suggestion Channel"
              value={form.suggestion_channel ?? ""}
              options={textChannels}
              onChange={(v) => update("suggestion_channel", v || null)}
              placeholder="Disabled"
            />
            <Select
              label="Approved Suggestions Channel"
              value={form.suggestion_approved_channel ?? ""}
              options={textChannels}
              onChange={(v) => update("suggestion_approved_channel", v || null)}
              placeholder="None"
            />
          </div>
        </Card>

        {/* Automod */}
        <Card title="Automod" description="Configure automatic moderation">
          <div className="space-y-3">
            <Toggle
              label="Spam Detection"
              description="Automatically detect and remove spam"
              checked={!!form.automod_spam_enabled}
              onChange={(v) => update("automod_spam_enabled", v ? 1 : 0)}
            />
            <Toggle
              label="Link Filter"
              description="Filter unauthorized links"
              checked={!!form.automod_links_enabled}
              onChange={(v) => update("automod_links_enabled", v ? 1 : 0)}
            />
            <Toggle
              label="Caps Filter"
              description="Filter excessive caps messages"
              checked={!!form.automod_caps_enabled}
              onChange={(v) => update("automod_caps_enabled", v ? 1 : 0)}
            />
            <Toggle
              label="Word Filter"
              description="Filter messages containing blacklisted words"
              checked={!!form.automod_wordfilter_enabled}
              onChange={(v) => update("automod_wordfilter_enabled", v ? 1 : 0)}
            />
          </div>
        </Card>

        {/* Music */}
        <Card title="Music">
          <div className="space-y-4">
            <Toggle
              label="24/7 Mode"
              description="Keep the bot in a voice channel at all times"
              checked={!!form.music_always_on}
              onChange={(v) => update("music_always_on", v ? 1 : 0)}
            />
            {!!form.music_always_on && (
              <Select
                label="Voice Channel"
                value={form.music_always_on_channel ?? ""}
                options={voiceChannels}
                onChange={(v) => update("music_always_on_channel", v || null)}
              />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
