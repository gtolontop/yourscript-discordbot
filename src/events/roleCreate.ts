import { Role } from "discord.js";
import type { Event } from "../types/index.js";
import { LogService } from "../services/LogService.js";
import { logger } from "../utils/index.js";

const event: Event<"roleCreate"> = {
  name: "roleCreate",
  async execute(client, role: Role) {
    logger.event(`Role created: @${role.name} | ${role.guild.name}`);

    const logService = new LogService(client);
    await logService.logRoleCreate(role);
  },
};

export default event;
