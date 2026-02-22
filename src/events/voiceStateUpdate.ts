import { VoiceState } from "discord.js";
import { joinVoiceChannel } from "@discordjs/voice";
import type { Event } from "../types/index.js";
import { LogService } from "../services/LogService.js";
import { logger } from "../utils/index.js";

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
      return;
    }

    const config = await client.db.guild.findUnique({
      where: { id: guildId },
    }) as any;

    // VoiceMaster: Handle joining the creation hub
    if (newState.channelId && config?.voiceMasterChannelId && newState.channelId === config.voiceMasterChannelId) {
      if (member.id !== client.user?.id) {
        // Check if user already owns a channel
        const existing = await (client.db as any).tempVoice.findUnique({
          where: { guildId_ownerId: { guildId, ownerId: member.id } }
        });

        const createTempVoice = async () => {
          const categoryId = config.voiceMasterCategoryId;
          try {
            const newChannel = await oldState.guild.channels.create({
              name: `🔊 ${member.user.username}'s Room`,
              type: 2, // ChannelType.GuildVoice
              parent: categoryId || null,
              permissionOverwrites: [
                {
                  id: member.id,
                  allow: ["ManageChannels", "MoveMembers", "MuteMembers", "DeafenMembers"],
                },
              ],
            });

            await (client.db as any).tempVoice.create({
              data: {
                id: newChannel.id,
                guildId,
                ownerId: member.id,
              },
            });

            await member.voice.setChannel(newChannel.id).catch(() => {});
          } catch (error) {
            logger.error(`VoiceMaster error creating channel for ${member.user.tag}`, error);
          }
        };

        if (existing) {
          const existingChannel = oldState.guild.channels.cache.get(existing.id);
          if (existingChannel) {
            await member.voice.setChannel(existing.id).catch(() => {});
          } else {
            // Stale database entry
            await (client.db as any).tempVoice.delete({ where: { id: existing.id } }).catch(() => {});
            await createTempVoice();
          }
        } else {
          await createTempVoice();
        }
      }
    }

    // VoiceMaster: Handle leaving a TempVoice channel
    if (oldState.channelId && oldState.channelId !== newState.channelId) {
      const channel = oldState.channel;
      if (channel && channel.members.size === 0) {
        // Check if it's a TempVoice
        const tempVoice = await (client.db as any).tempVoice.findUnique({
          where: { id: oldState.channelId },
        });

        if (tempVoice) {
          await channel.delete().catch(() => {});
          await (client.db as any).tempVoice.delete({ where: { id: oldState.channelId } }).catch(() => {});
        }
      }
    }

    const logService = new LogService(client);

    // User joined a voice channel
    if (!oldState.channelId && newState.channelId) {
      logger.event(`Voice joined: ${member.user.tag} -> #${newState.channel?.name} | ${member.guild.name}`);
      await logService.logVoiceJoin(member, newState.channel);
      return;
    }

    // User left a voice channel
    if (oldState.channelId && !newState.channelId) {
      logger.event(`Voice left: ${member.user.tag} <- #${oldState.channel?.name} | ${member.guild.name}`);
      await logService.logVoiceLeave(member, oldState.channel);
      return;
    }

    // User moved between voice channels
    if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      logger.event(`Voice moved: ${member.user.tag} #${oldState.channel?.name} -> #${newState.channel?.name} | ${member.guild.name}`);
      await logService.logVoiceMove(member, oldState.channel, newState.channel);
    }

    // Server mute change
    if (oldState.serverMute !== newState.serverMute) {
      logger.event(`Voice server ${newState.serverMute ? "muted" : "unmuted"}: ${member.user.tag} | ${member.guild.name}`);
      await logService.logVoiceServerMute(member, newState.serverMute ?? false);
    }

    // Server deafen change
    if (oldState.serverDeaf !== newState.serverDeaf) {
      logger.event(`Voice server ${newState.serverDeaf ? "deafened" : "undeafened"}: ${member.user.tag} | ${member.guild.name}`);
      await logService.logVoiceServerDeafen(member, newState.serverDeaf ?? false);
    }

    // Self mute change
    if (oldState.selfMute !== newState.selfMute) {
      logger.event(`Voice self ${newState.selfMute ? "muted" : "unmuted"}: ${member.user.tag} | ${member.guild.name}`);
      await logService.logVoiceSelfMute(member, newState.selfMute ?? false);
    }

    // Self deafen change
    if (oldState.selfDeaf !== newState.selfDeaf) {
      logger.event(`Voice self ${newState.selfDeaf ? "deafened" : "undeafened"}: ${member.user.tag} | ${member.guild.name}`);
      await logService.logVoiceSelfDeafen(member, newState.selfDeaf ?? false);
    }

    // Streaming change
    if (oldState.streaming !== newState.streaming) {
      logger.event(`Voice ${newState.streaming ? "started streaming" : "stopped streaming"}: ${member.user.tag} | ${member.guild.name}`);
      await logService.logVoiceStream(member, newState.streaming ?? false);
    }

    // Camera change
    if (oldState.selfVideo !== newState.selfVideo) {
      logger.event(`Voice camera ${newState.selfVideo ? "on" : "off"}: ${member.user.tag} | ${member.guild.name}`);
      await logService.logVoiceCamera(member, newState.selfVideo ?? false);
    }
  },
};

export default event;
