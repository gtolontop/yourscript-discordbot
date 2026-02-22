import {
  Guild,
  TextChannel,
  User,
  GuildMember,
  Message,
  VoiceState,
  Role,
  GuildChannel,
  GuildEmoji,
  Invite,
  AnyThreadChannel,
  ChannelType,
  EmbedBuilder,
} from "discord.js";
import type { Bot } from "../client/Bot.js";
import { Colors } from "../utils/index.js";
import { logger } from "../utils/index.js";

type LogType = "all" | "mod" | "message" | "voice" | "member" | "server" | "joinleave" | "ban" | "invite" | "thread" | "emoji" | "boost" | "cmd";

interface LogEntry {
  guildId: string;
  type: LogType;
  emoji: string;
  title: string;
  value: string;
  color: number;
  timestamp: number;
}

const LOG_COLORS = {
  Primary: Colors.Primary,
  Success: Colors.Success,
  Warning: Colors.Warning,
  Error: Colors.Error,
};

const channelTypeNames: Record<number, string> = {
  [ChannelType.GuildText]: "Text",
  [ChannelType.GuildVoice]: "Voice",
  [ChannelType.GuildCategory]: "Category",
  [ChannelType.GuildAnnouncement]: "Announcement",
  [ChannelType.GuildStageVoice]: "Stage",
  [ChannelType.GuildForum]: "Forum",
  [ChannelType.GuildMedia]: "Media",
};

// ===== GLOBAL LOG QUEUE (shared across all LogService instances) =====
const logQueue: LogEntry[] = [];
let flushInterval: ReturnType<typeof setInterval> | null = null;
let clientRef: Bot | null = null;

function getChannelForType(config: any, type: LogType): string | null {
  const map: Record<LogType, string | null> = {
    all: config.allLogsChannel,
    mod: config.modLogsChannel,
    message: config.msgLogsChannel,
    voice: config.voiceLogsChannel,
    member: config.memberLogsChannel,
    server: config.serverLogsChannel,
    joinleave: config.joinLeaveLogsChannel ?? config.memberLogsChannel,
    ban: config.banLogsChannel ?? config.modLogsChannel,
    invite: config.inviteLogsChannel ?? config.serverLogsChannel,
    thread: config.threadLogsChannel ?? config.serverLogsChannel,
    emoji: config.emojiLogsChannel ?? config.serverLogsChannel,
    boost: config.boostLogsChannel ?? config.memberLogsChannel,
    cmd: config.cmdLogsChannel,
  };
  return map[type] ?? null;
}

async function flushLogs() {
  if (logQueue.length === 0 || !clientRef) return;

  // Take all entries and clear queue
  const entries = logQueue.splice(0, logQueue.length);

  // Group by guildId
  const byGuild = new Map<string, LogEntry[]>();
  for (const entry of entries) {
    const arr = byGuild.get(entry.guildId) ?? [];
    arr.push(entry);
    byGuild.set(entry.guildId, arr);
  }

  for (const [guildId, guildEntries] of byGuild) {
    const guild = clientRef.guilds.cache.get(guildId);
    if (!guild) continue;

    const config = await clientRef.db.guild.findUnique({ where: { id: guildId } });
    if (!config) continue;

    // Group by destination channel
    const byChannel = new Map<string, LogEntry[]>();

    for (const entry of guildEntries) {
      const specificId = getChannelForType(config, entry.type);
      const allId = config.allLogsChannel;

      // Add to specific channel
      if (specificId && entry.type !== "all") {
        const arr = byChannel.get(specificId) ?? [];
        arr.push(entry);
        byChannel.set(specificId, arr);
      }

      // Add to all-logs channel (if different from specific)
      if (allId && allId !== specificId) {
        const arr = byChannel.get(allId) ?? [];
        arr.push(entry);
        byChannel.set(allId, arr);
      }
    }

    // Send batched embeds per channel
    for (const [channelId, channelEntries] of byChannel) {
      const channel = guild.channels.cache.get(channelId) as TextChannel | undefined;
      if (!channel) continue;

      // Split into chunks of max 20 fields per embed (leave room for limits)
      const chunks: LogEntry[][] = [];
      for (let i = 0; i < channelEntries.length; i += 20) {
        chunks.push(channelEntries.slice(i, i + 20));
      }

      for (const chunk of chunks) {
        // Use the most common color in the chunk
        const dominantColor = chunk[0].color;

        const embed = new EmbedBuilder()
          .setColor(dominantColor)
          .setTimestamp();

        // If only 1 entry, show it as a simple embed
        if (chunk.length === 1) {
          const e = chunk[0];
          embed.setTitle(e.title);
          embed.setDescription(e.value);
        } else {
          // Multiple entries: use fields
          const title = chunk.length <= 5
            ? `${chunk.length} events`
            : `${chunk.length} events`;
          embed.setTitle(`📋 ${title}`);

          for (const e of chunk) {
            // Truncate field value to 1024 chars
            const val = e.value.length > 1024 ? e.value.slice(0, 1021) + "..." : e.value;
            embed.addFields({ name: `${e.emoji} ${e.title}`, value: val, inline: false });
          }
        }

        // Check total embed length (6000 char limit)
        const totalLength = (embed.data.title?.length ?? 0)
          + (embed.data.description?.length ?? 0)
          + (embed.data.fields?.reduce((sum, f) => sum + f.name.length + f.value.length, 0) ?? 0);

        if (totalLength > 5900) {
          // Too big, send entries individually
          for (const e of chunk) {
            const smallEmbed = new EmbedBuilder()
              .setTitle(e.title)
              .setDescription(e.value.slice(0, 4000))
              .setColor(e.color)
              .setTimestamp();
            await channel.send({ embeds: [smallEmbed] }).catch(() => {});
          }
        } else {
          await channel.send({ embeds: [embed] }).catch(() => {});
        }
      }
    }
  }
}

export class LogService {
  constructor(private client: Bot) {
    // Set up global flush interval (only once)
    clientRef = client;
    if (!flushInterval) {
      flushInterval = setInterval(flushLogs, 60_000); // Flush every 60 seconds
      logger.info("Log queue started (flush every 60s)");
    }
  }

  private queueLog(guild: Guild, type: LogType, emoji: string, title: string, value: string, color: "Primary" | "Success" | "Warning" | "Error" = "Primary") {
    logQueue.push({
      guildId: guild.id,
      type,
      emoji,
      title,
      value,
      color: LOG_COLORS[color],
      timestamp: Date.now(),
    });
  }

  /** Force flush all queued logs now (useful for shutdown) */
  static async flush() {
    await flushLogs();
  }

  // ==================== COMMAND LOGS ====================

  logCommand(guild: Guild, user: User, command: string, status: "OK" | "FAILED", durationMs: number) {
    this.queueLog(guild, "cmd", status === "OK" ? "✅" : "❌", "Command Executed", [
      `**User:** ${user.tag} (\`${user.id}\`)`,
      `**Command:** \`${command}\``,
      `**Status:** ${status} (${durationMs}ms)`,
    ].join("\n"), status === "OK" ? "Success" : "Error");
  }

  logButton(guild: Guild, user: User, buttonId: string, status: "OK" | "FAILED", durationMs: number) {
    this.queueLog(guild, "cmd", "🔘", "Button Clicked", [
      `**User:** ${user.tag}`,
      `**Button:** \`${buttonId}\``,
      `**Status:** ${status} (${durationMs}ms)`,
    ].join("\n"), status === "OK" ? "Success" : "Error");
  }

  logModal(guild: Guild, user: User, modalId: string, status: "OK" | "FAILED", durationMs: number) {
    this.queueLog(guild, "cmd", "📝", "Modal Submitted", [
      `**User:** ${user.tag}`,
      `**Modal:** \`${modalId}\``,
      `**Status:** ${status} (${durationMs}ms)`,
    ].join("\n"), status === "OK" ? "Success" : "Error");
  }

  logSelectMenu(guild: Guild, user: User, menuId: string, values: string[], status: "OK" | "FAILED", durationMs: number) {
    this.queueLog(guild, "cmd", "📋", "Select Menu Used", [
      `**User:** ${user.tag}`,
      `**Menu:** \`${menuId}\``,
      `**Selected:** ${values.join(", ")}`,
      `**Status:** ${status} (${durationMs}ms)`,
    ].join("\n"), status === "OK" ? "Success" : "Error");
  }

  // ==================== MODERATION LOGS ====================

  async logBan(guild: Guild, target: User, moderator: User, reason?: string) {
    this.queueLog(guild, "mod", "🔨", "Member Banned", [
      `**User:** ${target.tag} (\`${target.id}\`)`,
      `**Moderator:** ${moderator.tag} (\`${moderator.id}\`)`,
      `**Reason:** ${reason ?? "No reason provided"}`,
    ].join("\n"), "Error");
  }

  async logUnban(guild: Guild, target: User, moderator: User) {
    this.queueLog(guild, "mod", "🔓", "Member Unbanned", [
      `**User:** ${target.tag} (\`${target.id}\`)`,
      `**Moderator:** ${moderator.tag} (\`${moderator.id}\`)`,
    ].join("\n"), "Success");
  }

  async logKick(guild: Guild, target: User, moderator: User, reason?: string) {
    this.queueLog(guild, "mod", "👢", "Member Kicked", [
      `**User:** ${target.tag} (\`${target.id}\`)`,
      `**Moderator:** ${moderator.tag} (\`${moderator.id}\`)`,
      `**Reason:** ${reason ?? "No reason provided"}`,
    ].join("\n"), "Warning");
  }

  async logMute(guild: Guild, target: User, moderator: User, duration: string, reason?: string) {
    this.queueLog(guild, "mod", "🔇", "Member Muted", [
      `**User:** ${target.tag} (\`${target.id}\`)`,
      `**Moderator:** ${moderator.tag} (\`${moderator.id}\`)`,
      `**Duration:** ${duration}`,
      `**Reason:** ${reason ?? "No reason provided"}`,
    ].join("\n"), "Warning");
  }

  async logUnmute(guild: Guild, target: User, moderator: User) {
    this.queueLog(guild, "mod", "🔊", "Member Unmuted", [
      `**User:** ${target.tag} (\`${target.id}\`)`,
      `**Moderator:** ${moderator.tag} (\`${moderator.id}\`)`,
    ].join("\n"), "Success");
  }

  async logWarn(guild: Guild, target: User, moderator: User, reason: string, warnCount: number) {
    this.queueLog(guild, "mod", "⚠️", "Member Warned", [
      `**User:** ${target.tag} (\`${target.id}\`)`,
      `**Moderator:** ${moderator.tag} (\`${moderator.id}\`)`,
      `**Reason:** ${reason}`,
      `**Total Warns:** ${warnCount}`,
    ].join("\n"), "Warning");
  }

  async logClear(guild: Guild, moderator: User, count: number, channelId: string, targetUser?: User) {
    this.queueLog(guild, "mod", "🗑️", "Messages Purged", [
      `**Moderator:** ${moderator.tag}`,
      `**Count:** ${count} messages`,
      `**Channel:** <#${channelId}>`,
      targetUser ? `**From:** ${targetUser.tag}` : null,
    ].filter(Boolean).join("\n"), "Warning");
  }

  async logTimeout(guild: Guild, member: GuildMember, duration: number | null) {
    if (duration) {
      const expiry = new Date(Date.now() + duration);
      this.queueLog(guild, "mod", "⏰", "Member Timed Out", [
        `**User:** ${member.user.tag} (\`${member.id}\`)`,
        `**Expires:** <t:${Math.floor(expiry.getTime() / 1000)}:R>`,
      ].join("\n"), "Warning");
    } else {
      this.queueLog(guild, "mod", "⏰", "Timeout Removed",
        `**User:** ${member.user.tag} (\`${member.id}\`)`, "Success");
    }
  }

  // ==================== MESSAGE LOGS ====================

  async logMessageDelete(message: Message) {
    if (!message.guild || message.author?.bot) return;

    const content = message.content || "*No text content*";
    const truncated = content.length > 500 ? content.slice(0, 500) + "..." : content;
    const attachments = message.attachments.map((a) => `[${a.name}](${a.url})`).join(", ");

    this.queueLog(message.guild, "message", "🗑️", "Message Deleted", [
      `**Author:** ${message.author?.tag ?? "Unknown"} (\`${message.author?.id ?? "?"}\`)`,
      `**Channel:** <#${message.channel.id}>`,
      `**Content:**\n\`\`\`${truncated}\`\`\``,
      attachments ? `**Attachments:** ${attachments}` : null,
      message.stickers.size > 0 ? `**Stickers:** ${message.stickers.map((s) => s.name).join(", ")}` : null,
    ].filter(Boolean).join("\n"), "Error");
  }

  async logMessageEdit(oldMessage: Message, newMessage: Message) {
    if (!oldMessage.guild || oldMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;

    const truncOld = (oldMessage.content || "*Empty*").slice(0, 300);
    const truncNew = (newMessage.content || "*Empty*").slice(0, 300);

    this.queueLog(oldMessage.guild, "message", "✏️", "Message Edited", [
      `**Author:** ${oldMessage.author?.tag ?? "Unknown"}`,
      `**Channel:** <#${oldMessage.channel.id}>`,
      `**Before:** ${truncOld}${(oldMessage.content?.length ?? 0) > 300 ? "..." : ""}`,
      `**After:** ${truncNew}${(newMessage.content?.length ?? 0) > 300 ? "..." : ""}`,
      `[Jump](${newMessage.url})`,
    ].join("\n"), "Warning");
  }

  async logMessageBulkDelete(guild: Guild, channelId: string, count: number, authors?: string[]) {
    const uniqueAuthors = authors ? [...new Set(authors)] : [];
    this.queueLog(guild, "message", "🗑️", "Bulk Message Delete", [
      `**Channel:** <#${channelId}>`,
      `**Count:** ${count} messages`,
      uniqueAuthors.length > 0 ? `**Authors:** ${uniqueAuthors.slice(0, 10).join(", ")}` : null,
    ].filter(Boolean).join("\n"), "Error");
  }

  async logMessagePin(message: Message, pinner: User | null) {
    if (!message.guild) return;
    this.queueLog(message.guild, "message", "📌", "Message Pinned", [
      `**Author:** ${message.author?.tag ?? "Unknown"}`,
      pinner ? `**Pinned by:** ${pinner.tag}` : null,
      `**Channel:** <#${message.channel.id}>`,
      `[Jump](${message.url})`,
    ].filter(Boolean).join("\n"), "Primary");
  }

  // ==================== VOICE LOGS ====================

  async logVoiceJoin(member: GuildMember, channel: VoiceState["channel"]) {
    if (!channel) return;
    this.queueLog(member.guild, "voice", "🔊", "Voice Connected", [
      `**Member:** ${member.user.tag}`,
      `**Channel:** 🔊 ${channel.name} (${channel.members.size} members)`,
    ].join("\n"), "Success");
  }

  async logVoiceLeave(member: GuildMember, channel: VoiceState["channel"]) {
    if (!channel) return;
    this.queueLog(member.guild, "voice", "🔇", "Voice Disconnected", [
      `**Member:** ${member.user.tag}`,
      `**Channel:** 🔊 ${channel.name} (${channel.members.size} remaining)`,
    ].join("\n"), "Error");
  }

  async logVoiceMove(member: GuildMember, oldChannel: VoiceState["channel"], newChannel: VoiceState["channel"]) {
    if (!oldChannel || !newChannel) return;
    this.queueLog(member.guild, "voice", "🔀", "Voice Channel Switch", [
      `**Member:** ${member.user.tag}`,
      `**From:** 🔊 ${oldChannel.name} → **To:** 🔊 ${newChannel.name}`,
    ].join("\n"), "Primary");
  }

  async logVoiceServerMute(member: GuildMember, muted: boolean) {
    this.queueLog(member.guild, "voice", muted ? "🔇" : "🔊", muted ? "Server Muted" : "Server Unmuted",
      `**Member:** ${member.user.tag} | **Channel:** 🔊 ${member.voice.channel?.name ?? "?"}`,
      muted ? "Warning" : "Success");
  }

  async logVoiceServerDeafen(member: GuildMember, deafened: boolean) {
    this.queueLog(member.guild, "voice", deafened ? "🔇" : "🔊", deafened ? "Server Deafened" : "Server Undeafened",
      `**Member:** ${member.user.tag} | **Channel:** 🔊 ${member.voice.channel?.name ?? "?"}`,
      deafened ? "Warning" : "Success");
  }

  async logVoiceSelfMute(member: GuildMember, muted: boolean) {
    this.queueLog(member.guild, "voice", "🎙️", muted ? "Self Muted" : "Self Unmuted",
      `**Member:** ${member.user.tag} | **Channel:** 🔊 ${member.voice.channel?.name ?? "?"}`,
      muted ? "Warning" : "Success");
  }

  async logVoiceSelfDeafen(member: GuildMember, deafened: boolean) {
    this.queueLog(member.guild, "voice", "🔇", deafened ? "Self Deafened" : "Self Undeafened",
      `**Member:** ${member.user.tag} | **Channel:** 🔊 ${member.voice.channel?.name ?? "?"}`,
      deafened ? "Warning" : "Success");
  }

  async logVoiceStream(member: GuildMember, streaming: boolean) {
    this.queueLog(member.guild, "voice", "📺", streaming ? "Started Streaming" : "Stopped Streaming",
      `**Member:** ${member.user.tag} | **Channel:** 🔊 ${member.voice.channel?.name ?? "?"}`,
      streaming ? "Success" : "Primary");
  }

  async logVoiceCamera(member: GuildMember, camera: boolean) {
    this.queueLog(member.guild, "voice", "📹", camera ? "Camera On" : "Camera Off",
      `**Member:** ${member.user.tag} | **Channel:** 🔊 ${member.voice.channel?.name ?? "?"}`,
      camera ? "Success" : "Primary");
  }

  // ==================== JOIN/LEAVE LOGS ====================

  async logMemberJoin(member: GuildMember) {
    const accountAge = Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24));
    const createdAt = Math.floor(member.user.createdTimestamp / 1000);

    this.queueLog(member.guild, "joinleave", "📥", "Member Joined", [
      `**Member:** ${member.user.tag} (\`${member.id}\`)`,
      `**Account:** <t:${createdAt}:R> (${accountAge}d)`,
      accountAge < 7 ? "⚠️ **New account!**" : null,
      `**Members:** ${member.guild.memberCount}`,
      member.user.bot ? "🤖 **Bot**" : null,
    ].filter(Boolean).join("\n"), "Success");
  }

  async logMemberLeave(member: GuildMember) {
    const roles = member.roles.cache
      .filter((r) => r.id !== member.guild.id)
      .map((r) => `<@&${r.id}>`)
      .slice(0, 10)
      .join(", ") || "None";

    const joinedAt = member.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;

    this.queueLog(member.guild, "joinleave", "📤", "Member Left", [
      `**Member:** ${member.user.tag} (\`${member.id}\`)`,
      joinedAt ? `**Joined:** <t:${joinedAt}:R>` : null,
      `**Roles:** ${roles}`,
      `**Members:** ${member.guild.memberCount}`,
    ].filter(Boolean).join("\n"), "Error");
  }

  // ==================== MEMBER LOGS ====================

  async logMemberRoleAdd(member: GuildMember, role: Role) {
    this.queueLog(member.guild, "member", "➕", "Role Added", [
      `**Member:** ${member.user.tag}`,
      `**Role:** <@&${role.id}> (${role.hexColor})`,
    ].join("\n"), "Success");
  }

  async logMemberRoleRemove(member: GuildMember, role: Role) {
    this.queueLog(member.guild, "member", "➖", "Role Removed", [
      `**Member:** ${member.user.tag}`,
      `**Role:** <@&${role.id}>`,
    ].join("\n"), "Warning");
  }

  async logMemberNicknameChange(member: GuildMember, oldNickname: string | null, newNickname: string | null) {
    this.queueLog(member.guild, "member", "✏️", "Nickname Changed", [
      `**Member:** ${member.user.tag}`,
      `**Before:** ${oldNickname ?? "*None*"} → **After:** ${newNickname ?? "*None*"}`,
    ].join("\n"), "Primary");
  }

  async logMemberAvatarUpdate(member: GuildMember, oldAvatar: string | null, newAvatar: string | null) {
    this.queueLog(member.guild, "member", "🖼️", "Server Avatar Changed",
      `**Member:** ${member.user.tag} | ${newAvatar ? "New avatar set" : "Avatar removed"}`,
      "Primary");
  }

  // ==================== BOOST LOGS ====================

  async logMemberBoost(member: GuildMember, boosting: boolean) {
    this.queueLog(member.guild, "boost", boosting ? "💎" : "💔", boosting ? "Server Boosted" : "Boost Removed", [
      `**Member:** ${member.user.tag} (\`${member.id}\`)`,
      `**Server boosts:** ${member.guild.premiumSubscriptionCount ?? 0}`,
      `**Boost level:** ${member.guild.premiumTier}`,
    ].join("\n"), boosting ? "Success" : "Error");
  }

  // ==================== SERVER LOGS ====================

  async logChannelCreate(channel: GuildChannel) {
    const typeName = channelTypeNames[channel.type] ?? `Type ${channel.type}`;
    this.queueLog(channel.guild, "server", "➕", "Channel Created", [
      `**Name:** #${channel.name} (${typeName})`,
      `**ID:** \`${channel.id}\``,
      channel.parent ? `**Category:** ${channel.parent.name}` : null,
    ].filter(Boolean).join("\n"), "Success");
  }

  async logChannelDelete(channel: GuildChannel) {
    const typeName = channelTypeNames[channel.type] ?? `Type ${channel.type}`;
    this.queueLog(channel.guild, "server", "➖", "Channel Deleted", [
      `**Name:** #${channel.name} (${typeName})`,
      `**ID:** \`${channel.id}\``,
    ].join("\n"), "Error");
  }

  async logChannelUpdate(oldChannel: GuildChannel, newChannel: GuildChannel) {
    const changes: string[] = [];

    if (oldChannel.name !== newChannel.name) changes.push(`**Name:** #${oldChannel.name} → #${newChannel.name}`);
    if (oldChannel.parent?.id !== newChannel.parent?.id) changes.push(`**Category:** ${oldChannel.parent?.name ?? "None"} → ${newChannel.parent?.name ?? "None"}`);

    if (oldChannel.isTextBased() && newChannel.isTextBased()) {
      const oldText = oldChannel as TextChannel;
      const newText = newChannel as TextChannel;
      if ("topic" in oldText && "topic" in newText && oldText.topic !== newText.topic)
        changes.push(`**Topic:** ${oldText.topic?.substring(0, 80) || "*None*"} → ${newText.topic?.substring(0, 80) || "*None*"}`);
      if ("nsfw" in oldText && "nsfw" in newText && oldText.nsfw !== newText.nsfw)
        changes.push(`**NSFW:** ${oldText.nsfw} → ${newText.nsfw}`);
      if ("rateLimitPerUser" in oldText && "rateLimitPerUser" in newText && oldText.rateLimitPerUser !== newText.rateLimitPerUser)
        changes.push(`**Slowmode:** ${oldText.rateLimitPerUser}s → ${newText.rateLimitPerUser}s`);
    }

    if (changes.length === 0) return;

    this.queueLog(newChannel.guild, "server", "✏️", "Channel Updated", [
      `**Channel:** <#${newChannel.id}>`,
      ...changes,
    ].join("\n"), "Warning");
  }

  async logRoleCreate(role: Role) {
    this.queueLog(role.guild, "server", "➕", "Role Created", [
      `**Name:** @${role.name} (${role.hexColor})`,
      `**ID:** \`${role.id}\``,
      `**Hoisted:** ${role.hoist ? "Yes" : "No"} | **Mentionable:** ${role.mentionable ? "Yes" : "No"}`,
    ].join("\n"), "Success");
  }

  async logRoleDelete(role: Role) {
    this.queueLog(role.guild, "server", "➖", "Role Deleted", [
      `**Name:** @${role.name} (${role.hexColor})`,
      `**Members had role:** ${role.members.size}`,
    ].join("\n"), "Error");
  }

  async logRoleUpdate(oldRole: Role, newRole: Role) {
    const changes: string[] = [];
    if (oldRole.name !== newRole.name) changes.push(`**Name:** @${oldRole.name} → @${newRole.name}`);
    if (oldRole.hexColor !== newRole.hexColor) changes.push(`**Color:** ${oldRole.hexColor} → ${newRole.hexColor}`);
    if (oldRole.hoist !== newRole.hoist) changes.push(`**Hoisted:** ${oldRole.hoist} → ${newRole.hoist}`);
    if (oldRole.mentionable !== newRole.mentionable) changes.push(`**Mentionable:** ${oldRole.mentionable} → ${newRole.mentionable}`);
    if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
      const added = newRole.permissions.toArray().filter((p) => !oldRole.permissions.has(p));
      const removed = oldRole.permissions.toArray().filter((p) => !newRole.permissions.has(p));
      if (added.length > 0) changes.push(`**+Perms:** ${added.slice(0, 5).join(", ")}`);
      if (removed.length > 0) changes.push(`**-Perms:** ${removed.slice(0, 5).join(", ")}`);
    }
    if (changes.length === 0) return;

    this.queueLog(newRole.guild, "server", "✏️", "Role Updated", [
      `**Role:** <@&${newRole.id}>`,
      ...changes,
    ].join("\n"), "Warning");
  }

  // ==================== EMOJI LOGS ====================

  async logEmojiCreate(emoji: GuildEmoji) {
    this.queueLog(emoji.guild, "emoji", "😀", "Emoji Created", [
      `**Name:** \`:${emoji.name}:\` ${emoji.toString()}`,
      `**Animated:** ${emoji.animated ? "Yes" : "No"}`,
    ].join("\n"), "Success");
  }

  async logEmojiDelete(emoji: GuildEmoji) {
    this.queueLog(emoji.guild, "emoji", "😀", "Emoji Deleted", [
      `**Name:** \`:${emoji.name}:\``,
      `**ID:** \`${emoji.id}\``,
    ].join("\n"), "Error");
  }

  async logEmojiUpdate(oldEmoji: GuildEmoji, newEmoji: GuildEmoji) {
    if (oldEmoji.name === newEmoji.name) return;
    this.queueLog(newEmoji.guild, "emoji", "😀", "Emoji Renamed",
      `\`:${oldEmoji.name}:\` → \`:${newEmoji.name}:\` ${newEmoji.toString()}`,
      "Warning");
  }

  // ==================== INVITE LOGS ====================

  async logInviteCreate(invite: Invite) {
    if (!invite.guild) return;
    this.queueLog(invite.guild as Guild, "invite", "🔗", "Invite Created", [
      `**Code:** \`${invite.code}\``,
      `**Creator:** ${invite.inviter?.tag ?? "Unknown"}`,
      `**Channel:** <#${invite.channelId}>`,
      `**Max uses:** ${invite.maxUses === 0 ? "∞" : invite.maxUses} | **Expires:** ${invite.maxAge === 0 ? "Never" : `${invite.maxAge! / 3600}h`}`,
    ].join("\n"), "Success");
  }

  async logInviteDelete(invite: Invite) {
    if (!invite.guild) return;
    this.queueLog(invite.guild as Guild, "invite", "🔗", "Invite Deleted", [
      `**Code:** \`${invite.code}\``,
      `**Uses:** ${invite.uses ?? 0}`,
    ].join("\n"), "Error");
  }

  // ==================== THREAD LOGS ====================

  async logThreadCreate(thread: AnyThreadChannel) {
    if (!thread.guild) return;
    this.queueLog(thread.guild, "thread", "🧵", "Thread Created", [
      `**Name:** ${thread.name}`,
      `**Parent:** <#${thread.parentId}>`,
      `**Creator:** <@${thread.ownerId}>`,
    ].join("\n"), "Success");
  }

  async logThreadDelete(thread: AnyThreadChannel) {
    if (!thread.guild) return;
    this.queueLog(thread.guild, "thread", "🧵", "Thread Deleted",
      `**Name:** ${thread.name} | **Parent:** <#${thread.parentId}>`,
      "Error");
  }

  async logThreadUpdate(oldThread: AnyThreadChannel, newThread: AnyThreadChannel) {
    const changes: string[] = [];
    if (oldThread.name !== newThread.name) changes.push(`**Name:** ${oldThread.name} → ${newThread.name}`);
    if (oldThread.archived !== newThread.archived) changes.push(`**Archived:** ${newThread.archived}`);
    if (oldThread.locked !== newThread.locked) changes.push(`**Locked:** ${newThread.locked}`);
    if (changes.length === 0) return;

    this.queueLog(newThread.guild, "thread", "🧵", "Thread Updated", [
      `**Thread:** <#${newThread.id}>`,
      ...changes,
    ].join("\n"), "Warning");
  }

  // ==================== GUILD LOGS ====================

  async logGuildUpdate(oldGuild: Guild, newGuild: Guild) {
    const changes: string[] = [];
    if (oldGuild.name !== newGuild.name) changes.push(`**Name:** ${oldGuild.name} → ${newGuild.name}`);
    if (oldGuild.icon !== newGuild.icon) changes.push(`**Icon:** Changed`);
    if (oldGuild.banner !== newGuild.banner) changes.push(`**Banner:** Changed`);
    if (oldGuild.verificationLevel !== newGuild.verificationLevel) changes.push(`**Verification:** ${oldGuild.verificationLevel} → ${newGuild.verificationLevel}`);
    if (oldGuild.vanityURLCode !== newGuild.vanityURLCode) changes.push(`**Vanity URL:** ${oldGuild.vanityURLCode ?? "None"} → ${newGuild.vanityURLCode ?? "None"}`);
    if (oldGuild.description !== newGuild.description) changes.push(`**Description:** Changed`);
    if (oldGuild.premiumTier !== newGuild.premiumTier) changes.push(`**Boost level:** ${oldGuild.premiumTier} → ${newGuild.premiumTier}`);
    if (oldGuild.afkChannelId !== newGuild.afkChannelId) changes.push(`**AFK channel:** Changed`);
    if (changes.length === 0) return;

    this.queueLog(newGuild, "server", "⚙️", "Server Updated", changes.join("\n"), "Warning");
  }

  // ==================== BAN EVENTS ====================

  async logBanAdd(guild: Guild, user: User) {
    this.queueLog(guild, "ban", "🔨", "Ban Detected",
      `**User:** ${user.tag} (\`${user.id}\`)`,
      "Error");
  }

  async logBanRemove(guild: Guild, user: User) {
    this.queueLog(guild, "ban", "🔓", "Unban Detected",
      `**User:** ${user.tag} (\`${user.id}\`)`,
      "Success");
  }
}
