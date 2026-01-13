import { GuildChannel, NonThreadGuildBasedChannel } from "discord.js";
import type { Event } from "../types/index.js";
import { LogService } from "../services/LogService.js";

const event: Event<"channelCreate"> = {
  name: "channelCreate",
  async execute(client, channel: NonThreadGuildBasedChannel) {
    if (!channel.guild) return;

    const logService = new LogService(client);
    await logService.logChannelCreate(channel as GuildChannel);
  },
};

export default event;
