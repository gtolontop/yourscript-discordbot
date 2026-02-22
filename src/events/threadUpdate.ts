import { AnyThreadChannel } from "discord.js";
import type { Event } from "../types/index.js";
import { LogService } from "../services/LogService.js";
import { logger } from "../utils/index.js";

const event: Event<"threadUpdate"> = {
  name: "threadUpdate",
  async execute(client, oldThread: AnyThreadChannel, newThread: AnyThreadChannel) {
    logger.event(`Thread updated: ${newThread.name} | ${newThread.guild.name}`);

    const logService = new LogService(client);
    await logService.logThreadUpdate(oldThread, newThread);
  },
};

export default event;
