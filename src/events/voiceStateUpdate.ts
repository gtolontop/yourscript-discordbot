import { VoiceState } from "discord.js";
import { joinVoiceChannel } from "@discordjs/voice";
import type { Event } from "../types/index.js";
import { LogService } from "../services/LogService.js";

const event: Event<"voiceStateUpdate"> = {
  name: "voiceStateUpdate",
  async execute(client, oldState: VoiceState, newState: VoiceState) {
    const member = newState.member ?? oldState.member;
    if (!member) return;

    const guildId = oldState.guild.id;

    // Handle bot's 24/7 reconnection
    if (member.id === client.user?.id) {
      if (!newState.channelId && oldState.channelId) {
        const session = await client.db.voiceSession.findUnique({
          where: { id: guildId },
        });

        if (session?.is247) {
          setTimeout(async () => {
            const currentSession = await client.db.voiceSession.findUnique({
              where: { id: guildId },
            });

            if (!currentSession?.is247) return;

            const channel = client.channels.cache.get(currentSession.channelId);
            if (!channel?.isVoiceBased()) return;

            joinVoiceChannel({
              channelId: currentSession.channelId,
              guildId: guildId,
              adapterCreator: oldState.guild.voiceAdapterCreator,
              selfDeaf: true,
            });
          }, 1000);
        }
      }
      return; // Don't log bot's own voice changes
    }

    // Log user voice state changes
    const logService = new LogService(client);

    // User joined a voice channel
    if (!oldState.channelId && newState.channelId) {
      await logService.logVoiceJoin(member, newState.channel);
    }
    // User left a voice channel
    else if (oldState.channelId && !newState.channelId) {
      await logService.logVoiceLeave(member, oldState.channel);
    }
    // User moved between voice channels
    else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      await logService.logVoiceMove(member, oldState.channel, newState.channel);
    }
  },
};

export default event;
