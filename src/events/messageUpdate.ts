import { Message, PartialMessage } from "discord.js";
import type { Event } from "../types/index.js";
import { LogService } from "../services/LogService.js";
import { logger } from "../utils/index.js";

const event: Event<"messageUpdate"> = {
  name: "messageUpdate",
  async execute(client, oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) {
    if (!oldMessage.guild || oldMessage.partial || newMessage.partial) return;
    if (oldMessage.content === newMessage.content) return;

    logger.event(`Message edited: ${oldMessage.author?.tag} in #${oldMessage.channel && "name" in oldMessage.channel ? oldMessage.channel.name : oldMessage.channelId} | ${oldMessage.guild.name}`);

    const logService = new LogService(client);
    await logService.logMessageEdit(oldMessage as Message, newMessage as Message);
  },
};

export default event;
