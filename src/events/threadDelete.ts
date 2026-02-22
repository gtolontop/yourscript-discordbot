import { AnyThreadChannel } from "discord.js";
import type { Event } from "../types/index.js";
import { LogService } from "../services/LogService.js";
import { logger } from "../utils/index.js";

const event: Event<"threadDelete"> = {
  name: "threadDelete",
  async execute(client, thread: AnyThreadChannel) {
    logger.event(`Thread deleted: ${thread.name} | ${thread.guild.name}`);

    const logService = new LogService(client);
    await logService.logThreadDelete(thread);
  },
};

export default event;
