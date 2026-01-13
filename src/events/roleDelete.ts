import { Role } from "discord.js";
import type { Event } from "../types/index.js";
import { LogService } from "../services/LogService.js";

const event: Event<"roleDelete"> = {
  name: "roleDelete",
  async execute(client, role: Role) {
    const logService = new LogService(client);
    await logService.logRoleDelete(role);
  },
};

export default event;
