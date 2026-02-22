import { GuildChannel, NonThreadGuildBasedChannel } from "discord.js";
import type { Event } from "../types/index.js";
import { LogService } from "../services/LogService.js";
import { logger } from "../utils/index.js";

const event: Event<"channelCreate"> = {
  name: "channelCreate",
  async execute(client, channel: NonThreadGuildBasedChannel) {
    if (!channel.guild) return;

    logger.event(`Channel created: #${channel.name} (${channel.type}) | ${channel.guild.name}`);

    const logService = new LogService(client);
    await logService.logChannelCreate(channel as GuildChannel);
  },
};

export default event;
