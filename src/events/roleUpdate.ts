import { Role } from "discord.js";
import type { Event } from "../types/index.js";
import { LogService } from "../services/LogService.js";

const event: Event<"roleUpdate"> = {
  name: "roleUpdate",
  async execute(client, oldRole: Role, newRole: Role) {
    const logService = new LogService(client);
    await logService.logRoleUpdate(oldRole, newRole);
  },
};

export default event;
