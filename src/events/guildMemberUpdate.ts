import { GuildMember, PartialGuildMember } from "discord.js";
import type { Event } from "../types/index.js";
import { LogService } from "../services/LogService.js";

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
      await logService.logMemberRoleAdd(newMember, role);
    }

    for (const [, role] of removedRoles) {
      await logService.logMemberRoleRemove(newMember, role);
    }

    // Check for nickname changes
    if (old.nickname !== newMember.nickname) {
      await logService.logMemberNicknameChange(newMember, old.nickname, newMember.nickname);
    }
  },
};

export default event;
