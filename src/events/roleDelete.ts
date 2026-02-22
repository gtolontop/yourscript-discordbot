import { Role } from "discord.js";
import type { Event } from "../types/index.js";
import { LogService } from "../services/LogService.js";
import { logger } from "../utils/index.js";

const event: Event<"roleDelete"> = {
  name: "roleDelete",
  async execute(client, role: Role) {
    logger.event(`Role deleted: @${role.name} | ${role.guild.name}`);

    const logService = new LogService(client);
    await logService.logRoleDelete(role);
  },
};

export default event;
