import { GuildEmoji } from "discord.js";
import type { Event } from "../types/index.js";
import { LogService } from "../services/LogService.js";
import { logger } from "../utils/index.js";

const event: Event<"emojiDelete"> = {
  name: "emojiDelete",
  async execute(client, emoji: GuildEmoji) {
    logger.event(`Emoji deleted: :${emoji.name}: | ${emoji.guild.name}`);

    const logService = new LogService(client);
    await logService.logEmojiDelete(emoji);
  },
};

export default event;
