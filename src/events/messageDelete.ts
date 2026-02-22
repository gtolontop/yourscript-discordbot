import { Message, PartialMessage } from "discord.js";
import type { Event } from "../types/index.js";
import { LogService } from "../services/LogService.js";
import { logger } from "../utils/index.js";

const event: Event<"messageDelete"> = {
  name: "messageDelete",
  async execute(client, message: Message | PartialMessage) {
    if (!message.guild || message.partial) return;

    const content = message.content?.substring(0, 50) ?? "(empty)";
    logger.event(`Message deleted: ${message.author?.tag} in #${message.channel && "name" in message.channel ? message.channel.name : message.channelId} | "${content}${(message.content?.length ?? 0) > 50 ? "..." : ""}" | ${message.guild.name}`);

    const logService = new LogService(client);
    await logService.logMessageDelete(message as Message);
  },
};

export default event;
