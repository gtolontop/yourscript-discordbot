import { Message, PartialMessage } from "discord.js";
import type { Event } from "../types/index.js";
import { LogService } from "../services/LogService.js";

const event: Event<"messageUpdate"> = {
  name: "messageUpdate",
  async execute(client, oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) {
    if (!oldMessage.guild || oldMessage.partial || newMessage.partial) return;

    const logService = new LogService(client);
    await logService.logMessageEdit(oldMessage as Message, newMessage as Message);
  },
};

export default event;
