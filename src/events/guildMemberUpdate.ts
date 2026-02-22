import { GuildMember, PartialGuildMember } from "discord.js";
import type { Event } from "../types/index.js";
import { LogService } from "../services/LogService.js";
import { logger } from "../utils/index.js";

const event: Event<"guildMemberUpdate"> = {
  name: "guildMemberUpdate",
  async execute(client, oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
    if (oldMember.partial) return;

    const logService = new LogService(client);
    const old = oldMember as GuildMember;

    // Check for role changes
    const addedRoles = newMember.roles.cache.filter((role) => !old.roles.cache.has(role.id));
    const removedRoles = old.roles.cache.filter((role) => !newMember.roles.cache.has(role.id));

    for (const [, role] of addedRoles) {
      logger.event(`Role added: ${newMember.user.tag} +@${role.name} | ${newMember.guild.name}`);
      await logService.logMemberRoleAdd(newMember, role);
    }

    for (const [, role] of removedRoles) {
      logger.event(`Role removed: ${newMember.user.tag} -@${role.name} | ${newMember.guild.name}`);
      await logService.logMemberRoleRemove(newMember, role);
    }

    // Check for nickname changes
    if (old.nickname !== newMember.nickname) {
      logger.event(`Nickname changed: ${newMember.user.tag} "${old.nickname ?? "(none)"}" -> "${newMember.nickname ?? "(none)"}" | ${newMember.guild.name}`);
      await logService.logMemberNicknameChange(newMember, old.nickname, newMember.nickname);
    }

    // Check for boost changes
    if (!old.premiumSince && newMember.premiumSince) {
      logger.event(`Server boosted: ${newMember.user.tag} | ${newMember.guild.name}`);
      await logService.logMemberBoost(newMember, true);
    } else if (old.premiumSince && !newMember.premiumSince) {
      logger.event(`Boost removed: ${newMember.user.tag} | ${newMember.guild.name}`);
      await logService.logMemberBoost(newMember, false);
    }

    // Check for server avatar changes
    if (old.avatar !== newMember.avatar) {
      logger.event(`Server avatar changed: ${newMember.user.tag} | ${newMember.guild.name}`);
      await logService.logMemberAvatarUpdate(newMember, old.avatar, newMember.avatar);
    }

    // Check for timeout changes
    if (old.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp) {
      if (newMember.communicationDisabledUntilTimestamp && newMember.communicationDisabledUntilTimestamp > Date.now()) {
        const duration = newMember.communicationDisabledUntilTimestamp - Date.now();
        logger.event(`Member timed out: ${newMember.user.tag} | ${newMember.guild.name}`);
        await logService.logTimeout(newMember.guild, newMember, duration);
      } else if (old.communicationDisabledUntilTimestamp && old.communicationDisabledUntilTimestamp > Date.now()) {
        logger.event(`Timeout removed: ${newMember.user.tag} | ${newMember.guild.name}`);
        await logService.logTimeout(newMember.guild, newMember, null);
      }
    }
  },
};

export default event;
