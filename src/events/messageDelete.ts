import { Message, PartialMessage } from "discord.js";
import type { Event } from "../types/index.js";
import { LogService } from "../services/LogService.js";

const event: Event<"messageDelete"> = {
  name: "messageDelete",
  async execute(client, message: Message | PartialMessage) {
    if (!message.guild || message.partial) return;

    const logService = new LogService(client);
    await logService.logMessageDelete(message as Message);
  },
};

export default event;
