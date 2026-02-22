import { GuildBan } from "discord.js";
import type { Event } from "../types/index.js";
import { LogService } from "../services/LogService.js";
import { logger } from "../utils/index.js";

const event: Event<"guildBanRemove"> = {
  name: "guildBanRemove",
  async execute(client, ban: GuildBan) {
    logger.event(`Unban detected: ${ban.user.tag} (${ban.user.id}) | ${ban.guild.name}`);

    const logService = new LogService(client);
    await logService.logBanRemove(ban.guild, ban.user);
  },
};

export default event;
