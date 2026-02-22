import { GuildEmoji } from "discord.js";
import type { Event } from "../types/index.js";
import { LogService } from "../services/LogService.js";
import { logger } from "../utils/index.js";

const event: Event<"emojiUpdate"> = {
  name: "emojiUpdate",
  async execute(client, oldEmoji: GuildEmoji, newEmoji: GuildEmoji) {
    logger.event(`Emoji updated: :${oldEmoji.name}: -> :${newEmoji.name}: | ${newEmoji.guild.name}`);

    const logService = new LogService(client);
    await logService.logEmojiUpdate(oldEmoji, newEmoji);
  },
};

export default event;
