import { type VoiceState } from "discord.js";
import type { Event } from "../types/index.js";
import { Bot } from "../client/Bot.js";
import { logger } from "../utils/logger.js";

export default {
  name: "voiceStateUpdate",

  async execute(client: Bot, oldState: VoiceState, newState: VoiceState) {
    const member = newState.member ?? oldState.member;
    if (!member || member.user.bot) return;

    const tag = member.user.tag;

    // User joined a voice channel
    if (!oldState.channelId && newState.channelId) {
      logger.info(
        `[Voice] ${tag} joined #${newState.channel?.name} in ${newState.guild.name}`,
      );
      return;
    }

    // User left a voice channel
    if (oldState.channelId && !newState.channelId) {
      logger.info(
        `[Voice] ${tag} left #${oldState.channel?.name} in ${oldState.guild.name}`,
      );
      return;
    }

    // User moved between voice channels
    if (
      oldState.channelId &&
      newState.channelId &&
      oldState.channelId !== newState.channelId
    ) {
      logger.info(
        `[Voice] ${tag} moved from #${oldState.channel?.name} to #${newState.channel?.name} in ${newState.guild.name}`,
      );
    }
  },
} satisfies Event<"voiceStateUpdate">;
