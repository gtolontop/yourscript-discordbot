import { Role } from "discord.js";
import type { Event } from "../types/index.js";
import { LogService } from "../services/LogService.js";
import { logger } from "../utils/index.js";

const event: Event<"roleUpdate"> = {
  name: "roleUpdate",
  async execute(client, oldRole: Role, newRole: Role) {
    if (oldRole.name !== newRole.name) {
      logger.event(`Role renamed: @${oldRole.name} -> @${newRole.name} | ${newRole.guild.name}`);
    } else {
      logger.event(`Role updated: @${newRole.name} | ${newRole.guild.name}`);
    }

    const logService = new LogService(client);
    await logService.logRoleUpdate(oldRole, newRole);
  },
};

export default event;
