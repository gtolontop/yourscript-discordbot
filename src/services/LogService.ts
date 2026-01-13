import {
  Guild,
  TextChannel,
  User,
  GuildMember,
  Message,
  VoiceState,
  Role,
  GuildChannel,
  AuditLogEvent,
} from "discord.js";
import type { Bot } from "../client/Bot.js";
import { createMessage, warningMessage, errorMessage, successMessage } from "../utils/index.js";

type LogType = "all" | "mod" | "message" | "voice" | "member" | "server";

interface LogOptions {
  title: string;
  description: string;
  color?: "Primary" | "Success" | "Warning" | "Error";
  footer?: string;
}

export class LogService {
  constructor(private client: Bot) {}

  private async getLogChannels(guildId: string) {
    const config = await this.client.db.guild.findUnique({
      where: { id: guildId },
    });
    return config;
  }

  private async sendLog(guild: Guild, type: LogType, options: LogOptions) {
    const config = await this.getLogChannels(guild.id);
    if (!config) return;

    const channelMap: Record<LogType, string | null> = {
      all: config.allLogsChannel,
      mod: config.modLogsChannel,
      message: config.msgLogsChannel,
      voice: config.voiceLogsChannel,
      member: config.memberLogsChannel,
      server: config.serverLogsChannel,
    };

    const specificChannelId = channelMap[type];
    const allChannelId = config.allLogsChannel;

    const message = createMessage({
      title: options.title,
      description: options.description,
      color: options.color ?? "Primary",
      footer: options.footer ?? `${new Date().toLocaleString("fr-FR")}`,
    });

    // Send to specific channel
    if (specificChannelId && type !== "all") {
      const channel = guild.channels.cache.get(specificChannelId) as TextChannel | undefined;
      if (channel) {
        await channel.send(message).catch(() => {});
      }
    }

    // Send to all-logs channel
    if (allChannelId) {
      const allChannel = guild.channels.cache.get(allChannelId) as TextChannel | undefined;
      if (allChannel) {
        await allChannel.send(message).catch(() => {});
      }
    }
  }

  // ==================== MODERATION LOGS ====================

  async logBan(guild: Guild, target: User, moderator: User, reason?: string) {
    await this.sendLog(guild, "mod", {
      title: "🔨 Membre banni",
      description: [
        `**Utilisateur:** ${target.tag} (${target.id})`,
        `**Modérateur:** ${moderator.tag}`,
        `**Raison:** ${reason ?? "Aucune raison fournie"}`,
      ].join("\n"),
      color: "Error",
    });
  }

  async logUnban(guild: Guild, target: User, moderator: User) {
    await this.sendLog(guild, "mod", {
      title: "🔓 Membre débanni",
      description: [
        `**Utilisateur:** ${target.tag} (${target.id})`,
        `**Modérateur:** ${moderator.tag}`,
      ].join("\n"),
      color: "Success",
    });
  }

  async logKick(guild: Guild, target: User, moderator: User, reason?: string) {
    await this.sendLog(guild, "mod", {
      title: "👢 Membre expulsé",
      description: [
        `**Utilisateur:** ${target.tag} (${target.id})`,
        `**Modérateur:** ${moderator.tag}`,
        `**Raison:** ${reason ?? "Aucune raison fournie"}`,
      ].join("\n"),
      color: "Warning",
    });
  }

  async logMute(guild: Guild, target: User, moderator: User, duration: string, reason?: string) {
    await this.sendLog(guild, "mod", {
      title: "🔇 Membre mute",
      description: [
        `**Utilisateur:** ${target.tag} (${target.id})`,
        `**Modérateur:** ${moderator.tag}`,
        `**Durée:** ${duration}`,
        `**Raison:** ${reason ?? "Aucune raison fournie"}`,
      ].join("\n"),
      color: "Warning",
    });
  }

  async logUnmute(guild: Guild, target: User, moderator: User) {
    await this.sendLog(guild, "mod", {
      title: "🔊 Membre unmute",
      description: [
        `**Utilisateur:** ${target.tag} (${target.id})`,
        `**Modérateur:** ${moderator.tag}`,
      ].join("\n"),
      color: "Success",
    });
  }

  async logWarn(guild: Guild, target: User, moderator: User, reason: string, warnCount: number) {
    await this.sendLog(guild, "mod", {
      title: "⚠️ Membre averti",
      description: [
        `**Utilisateur:** ${target.tag} (${target.id})`,
        `**Modérateur:** ${moderator.tag}`,
        `**Raison:** ${reason}`,
        `**Warns totaux:** ${warnCount}`,
      ].join("\n"),
      color: "Warning",
    });
  }

  async logClear(guild: Guild, moderator: User, count: number, channelId: string, targetUser?: User) {
    await this.sendLog(guild, "mod", {
      title: "🗑️ Messages supprimés",
      description: [
        `**Modérateur:** ${moderator.tag}`,
        `**Nombre:** ${count} messages`,
        `**Channel:** <#${channelId}>`,
        targetUser ? `**De:** ${targetUser.tag}` : null,
      ].filter(Boolean).join("\n"),
      color: "Warning",
    });
  }

  // ==================== MESSAGE LOGS ====================

  async logMessageDelete(message: Message) {
    if (!message.guild || message.author?.bot) return;

    const content = message.content || "*Pas de contenu texte*";
    const truncated = content.length > 1000 ? content.slice(0, 1000) + "..." : content;

    await this.sendLog(message.guild, "message", {
      title: "🗑️ Message supprimé",
      description: [
        `**Auteur:** ${message.author?.tag ?? "Inconnu"} (${message.author?.id ?? "?"})`,
        `**Channel:** <#${message.channel.id}>`,
        `**Contenu:**\n\`\`\`${truncated}\`\`\``,
        message.attachments.size > 0 ? `**Pièces jointes:** ${message.attachments.size}` : null,
      ].filter(Boolean).join("\n"),
      color: "Error",
    });
  }

  async logMessageEdit(oldMessage: Message, newMessage: Message) {
    if (!oldMessage.guild || oldMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;

    const oldContent = oldMessage.content || "*Vide*";
    const newContent = newMessage.content || "*Vide*";
    const truncateOld = oldContent.length > 500 ? oldContent.slice(0, 500) + "..." : oldContent;
    const truncateNew = newContent.length > 500 ? newContent.slice(0, 500) + "..." : newContent;

    await this.sendLog(oldMessage.guild, "message", {
      title: "✏️ Message modifié",
      description: [
        `**Auteur:** ${oldMessage.author?.tag ?? "Inconnu"}`,
        `**Channel:** <#${oldMessage.channel.id}>`,
        `**Avant:**\n\`\`\`${truncateOld}\`\`\``,
        `**Après:**\n\`\`\`${truncateNew}\`\`\``,
        `[Aller au message](${newMessage.url})`,
      ].join("\n"),
      color: "Warning",
    });
  }

  async logMessageBulkDelete(guild: Guild, channelId: string, count: number) {
    await this.sendLog(guild, "message", {
      title: "🗑️ Messages supprimés en masse",
      description: [
        `**Channel:** <#${channelId}>`,
        `**Nombre:** ${count} messages`,
      ].join("\n"),
      color: "Error",
    });
  }

  // ==================== VOICE LOGS ====================

  async logVoiceJoin(member: GuildMember, channel: VoiceState["channel"]) {
    if (!channel) return;

    await this.sendLog(member.guild, "voice", {
      title: "🔊 Connexion vocale",
      description: [
        `**Membre:** ${member.user.tag}`,
        `**Channel:** ${channel.name}`,
      ].join("\n"),
      color: "Success",
    });
  }

  async logVoiceLeave(member: GuildMember, channel: VoiceState["channel"]) {
    if (!channel) return;

    await this.sendLog(member.guild, "voice", {
      title: "🔇 Déconnexion vocale",
      description: [
        `**Membre:** ${member.user.tag}`,
        `**Channel:** ${channel.name}`,
      ].join("\n"),
      color: "Error",
    });
  }

  async logVoiceMove(member: GuildMember, oldChannel: VoiceState["channel"], newChannel: VoiceState["channel"]) {
    if (!oldChannel || !newChannel) return;

    await this.sendLog(member.guild, "voice", {
      title: "🔀 Changement de salon vocal",
      description: [
        `**Membre:** ${member.user.tag}`,
        `**De:** ${oldChannel.name}`,
        `**Vers:** ${newChannel.name}`,
      ].join("\n"),
      color: "Primary",
    });
  }

  // ==================== MEMBER LOGS ====================

  async logMemberJoin(member: GuildMember) {
    const accountAge = Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24));

    await this.sendLog(member.guild, "member", {
      title: "📥 Membre rejoint",
      description: [
        `**Membre:** ${member.user.tag} (${member.id})`,
        `**Compte créé:** il y a ${accountAge} jours`,
        `**Membres totaux:** ${member.guild.memberCount}`,
      ].join("\n"),
      color: "Success",
    });
  }

  async logMemberLeave(member: GuildMember) {
    const roles = member.roles.cache
      .filter((r) => r.id !== member.guild.id)
      .map((r) => r.name)
      .join(", ") || "Aucun";

    await this.sendLog(member.guild, "member", {
      title: "📤 Membre parti",
      description: [
        `**Membre:** ${member.user.tag} (${member.id})`,
        `**Rôles:** ${roles}`,
        `**Membres totaux:** ${member.guild.memberCount}`,
      ].join("\n"),
      color: "Error",
    });
  }

  async logMemberRoleAdd(member: GuildMember, role: Role) {
    await this.sendLog(member.guild, "member", {
      title: "➕ Rôle ajouté",
      description: [
        `**Membre:** ${member.user.tag}`,
        `**Rôle:** ${role.name}`,
      ].join("\n"),
      color: "Success",
    });
  }

  async logMemberRoleRemove(member: GuildMember, role: Role) {
    await this.sendLog(member.guild, "member", {
      title: "➖ Rôle retiré",
      description: [
        `**Membre:** ${member.user.tag}`,
        `**Rôle:** ${role.name}`,
      ].join("\n"),
      color: "Warning",
    });
  }

  async logMemberNicknameChange(member: GuildMember, oldNickname: string | null, newNickname: string | null) {
    await this.sendLog(member.guild, "member", {
      title: "✏️ Pseudo modifié",
      description: [
        `**Membre:** ${member.user.tag}`,
        `**Avant:** ${oldNickname ?? "*Aucun*"}`,
        `**Après:** ${newNickname ?? "*Aucun*"}`,
      ].join("\n"),
      color: "Primary",
    });
  }

  // ==================== SERVER LOGS ====================

  async logChannelCreate(channel: GuildChannel) {
    await this.sendLog(channel.guild, "server", {
      title: "➕ Channel créé",
      description: [
        `**Nom:** ${channel.name}`,
        `**Type:** ${channel.type}`,
        `**ID:** ${channel.id}`,
      ].join("\n"),
      color: "Success",
    });
  }

  async logChannelDelete(channel: GuildChannel) {
    await this.sendLog(channel.guild, "server", {
      title: "➖ Channel supprimé",
      description: [
        `**Nom:** ${channel.name}`,
        `**Type:** ${channel.type}`,
        `**ID:** ${channel.id}`,
      ].join("\n"),
      color: "Error",
    });
  }

  async logRoleCreate(role: Role) {
    await this.sendLog(role.guild, "server", {
      title: "➕ Rôle créé",
      description: [
        `**Nom:** ${role.name}`,
        `**Couleur:** ${role.hexColor}`,
        `**ID:** ${role.id}`,
      ].join("\n"),
      color: "Success",
    });
  }

  async logRoleDelete(role: Role) {
    await this.sendLog(role.guild, "server", {
      title: "➖ Rôle supprimé",
      description: [
        `**Nom:** ${role.name}`,
        `**Couleur:** ${role.hexColor}`,
        `**ID:** ${role.id}`,
      ].join("\n"),
      color: "Error",
    });
  }

  async logRoleUpdate(oldRole: Role, newRole: Role) {
    const changes: string[] = [];

    if (oldRole.name !== newRole.name) {
      changes.push(`**Nom:** ${oldRole.name} → ${newRole.name}`);
    }
    if (oldRole.hexColor !== newRole.hexColor) {
      changes.push(`**Couleur:** ${oldRole.hexColor} → ${newRole.hexColor}`);
    }
    if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
      changes.push(`**Permissions modifiées**`);
    }

    if (changes.length === 0) return;

    await this.sendLog(newRole.guild, "server", {
      title: "✏️ Rôle modifié",
      description: [
        `**Rôle:** ${newRole.name}`,
        ...changes,
      ].join("\n"),
      color: "Warning",
    });
  }
}
