import { DMChannel, GuildChannel, NonThreadGuildBasedChannel } from "discord.js";
import type { Event } from "../types/index.js";
import { LogService } from "../services/LogService.js";
import { logger } from "../utils/index.js";

const event: Event<"channelUpdate"> = {
  name: "channelUpdate",
  async execute(client, oldChannel: DMChannel | NonThreadGuildBasedChannel, newChannel: DMChannel | NonThreadGuildBasedChannel) {
    if (oldChannel.isDMBased() || newChannel.isDMBased()) return;

    logger.event(`Channel updated: #${newChannel.name} | ${newChannel.guild.name}`);

    const logService = new LogService(client);
    await logService.logChannelUpdate(oldChannel as GuildChannel, newChannel as GuildChannel);
  },
};

export default event;
