import { GuildBan } from "discord.js";
import type { Event } from "../types/index.js";
import { LogService } from "../services/LogService.js";
import { logger } from "../utils/index.js";

const event: Event<"guildBanAdd"> = {
  name: "guildBanAdd",
  async execute(client, ban: GuildBan) {
    logger.event(`Ban detected: ${ban.user.tag} (${ban.user.id}) | ${ban.guild.name}`);

    const logService = new LogService(client);
    await logService.logBanAdd(ban.guild, ban.user);
  },
};

export default event;
