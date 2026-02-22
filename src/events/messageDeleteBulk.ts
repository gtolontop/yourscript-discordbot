import { Collection, Message, PartialMessage, Snowflake } from "discord.js";
import type { Event } from "../types/index.js";
import { LogService } from "../services/LogService.js";
import { logger } from "../utils/index.js";

const event: Event<"messageDeleteBulk"> = {
  name: "messageDeleteBulk",
  async execute(client, messages: Collection<Snowflake, Message | PartialMessage>, channel: any) {
    const firstMsg = messages.first();
    if (!firstMsg?.guild) return;

    const authors = messages
      .filter((m) => !m.partial && m.author && !m.author.bot)
      .map((m) => (m as Message).author.tag);

    logger.event(`Bulk delete: ${messages.size} messages in #${channel.name ?? channel.id} | ${firstMsg.guild.name}`);

    const logService = new LogService(client);
    await logService.logMessageBulkDelete(firstMsg.guild, channel.id, messages.size, authors as string[]);
  },
};

export default event;
