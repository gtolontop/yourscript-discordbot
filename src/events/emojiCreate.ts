import { GuildEmoji } from "discord.js";
import type { Event } from "../types/index.js";
import { LogService } from "../services/LogService.js";
import { logger } from "../utils/index.js";

const event: Event<"emojiCreate"> = {
  name: "emojiCreate",
  async execute(client, emoji: GuildEmoji) {
    logger.event(`Emoji created: :${emoji.name}: | ${emoji.guild.name}`);

    const logService = new LogService(client);
    await logService.logEmojiCreate(emoji);
  },
};

export default event;
