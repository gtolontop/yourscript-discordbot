import { AnyThreadChannel } from "discord.js";
import type { Event } from "../types/index.js";
import { LogService } from "../services/LogService.js";
import { logger } from "../utils/index.js";

const event: Event<"threadCreate"> = {
  name: "threadCreate",
  async execute(client, thread: AnyThreadChannel, newlyCreated: boolean) {
    if (!newlyCreated) return;

    logger.event(`Thread created: ${thread.name} in #${thread.parent?.name ?? "unknown"} | ${thread.guild.name}`);

    const logService = new LogService(client);
    await logService.logThreadCreate(thread);
  },
};

export default event;
