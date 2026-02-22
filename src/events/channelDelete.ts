import { DMChannel, GuildChannel, NonThreadGuildBasedChannel } from "discord.js";
import type { Event } from "../types/index.js";
import { LogService } from "../services/LogService.js";
import { logger } from "../utils/index.js";

const event: Event<"channelDelete"> = {
  name: "channelDelete",
  async execute(client, channel: DMChannel | NonThreadGuildBasedChannel) {
    if (channel.isDMBased()) return;

    logger.event(`Channel deleted: #${channel.name} | ${channel.guild.name}`);

    const logService = new LogService(client);
    await logService.logChannelDelete(channel as GuildChannel);
  },
};

export default event;
