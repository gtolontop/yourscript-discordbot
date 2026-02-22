import { Guild } from "discord.js";
import type { Event } from "../types/index.js";
import { LogService } from "../services/LogService.js";
import { logger } from "../utils/index.js";

const event: Event<"guildUpdate"> = {
  name: "guildUpdate",
  async execute(client, oldGuild: Guild, newGuild: Guild) {
    logger.event(`Guild updated: ${newGuild.name}`);

    const logService = new LogService(client);
    await logService.logGuildUpdate(oldGuild, newGuild);
  },
};

export default event;
