import {
  type GuildMember,
  type PermissionResolvable,
  PermissionFlagsBits,
} from "discord.js";

/**
 * Check if a member has the required permissions
 */
export function hasPermissions(
  member: GuildMember,
  permissions: PermissionResolvable[]
): boolean {
  return permissions.every((perm) => member.permissions.has(perm));
}

/**
 * Check if a member is a moderator (has Manage Messages or higher)
 */
export function isModerator(member: GuildMember): boolean {
  return member.permissions.has(PermissionFlagsBits.ManageMessages);
}

/**
 * Check if a member is an admin (has Administrator or Manage Guild)
 */
export function isAdmin(member: GuildMember): boolean {
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild)
  );
}

/**
 * Check if member1 can moderate member2 (higher role hierarchy)
 */
export function canModerate(moderator: GuildMember, target: GuildMember): boolean {
  // Can't moderate yourself
  if (moderator.id === target.id) return false;

  // Can't moderate the owner
  if (target.id === target.guild.ownerId) return false;

  // Check role hierarchy
  return moderator.roles.highest.position > target.roles.highest.position;
}

/**
 * Check if the bot can moderate a member
 */
export function botCanModerate(target: GuildMember): boolean {
  const bot = target.guild.members.me;
  if (!bot) return false;

  // Can't moderate the owner
  if (target.id === target.guild.ownerId) return false;

  // Check role hierarchy
  return bot.roles.highest.position > target.roles.highest.position;
}

/**
 * Common permission checks
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
