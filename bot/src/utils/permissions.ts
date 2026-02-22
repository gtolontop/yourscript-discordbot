import {
  type GuildMember,
  type PermissionResolvable,
  PermissionFlagsBits,
} from "discord.js";

/**
 * Check if a member has all the specified permissions.
 */
export function hasPermission(
  member: GuildMember,
  permissions: PermissionResolvable[],
): boolean {
  return permissions.every((perm) => member.permissions.has(perm));
}

/**
 * Check if a member is a moderator (has Manage Messages or higher).
 */
export function isModerator(member: GuildMember): boolean {
  return member.permissions.has(PermissionFlagsBits.ManageMessages);
}

/**
 * Check if a member is an admin (has Administrator or Manage Guild).
 */
export function isAdmin(member: GuildMember): boolean {
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild)
  );
}

/**
 * Check if the moderator can moderate the target member (role hierarchy check).
 * Returns false if trying to moderate yourself or the server owner.
 */
export function canModerate(
  moderator: GuildMember,
  target: GuildMember,
): boolean {
  if (moderator.id === target.id) return false;
  if (target.id === target.guild.ownerId) return false;
  return moderator.roles.highest.position > target.roles.highest.position;
}

/**
 * Check if the bot can moderate a target member (role hierarchy check).
 * Returns false if the target is the server owner or outranks the bot.
 */
export function botCanModerate(target: GuildMember): boolean {
  const bot = target.guild.members.me;
  if (!bot) return false;
  if (target.id === target.guild.ownerId) return false;
  return bot.roles.highest.position > target.roles.highest.position;
}

/**
 * Commonly used permission flags for quick access.
 */
export const Permissions = {
  BanMembers: PermissionFlagsBits.BanMembers,
  KickMembers: PermissionFlagsBits.KickMembers,
  ModerateMembers: PermissionFlagsBits.ModerateMembers,
  ManageMessages: PermissionFlagsBits.ManageMessages,
  ManageChannels: PermissionFlagsBits.ManageChannels,
  ManageGuild: PermissionFlagsBits.ManageGuild,
  Administrator: PermissionFlagsBits.Administrator,
} as const;
