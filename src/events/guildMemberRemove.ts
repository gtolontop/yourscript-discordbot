import { GuildMember, PartialGuildMember } from "discord.js";
import type { Event } from "../types/index.js";
import { LogService } from "../services/LogService.js";
import { logger } from "../utils/index.js";

const event: Event<"guildMemberRemove"> = {
  name: "guildMemberRemove",
  async execute(client, member: GuildMember | PartialGuildMember) {
    if (member.partial) return;

    logger.event(`Member left: ${member.user.tag} (${member.id}) | ${member.guild.name}`);

    const logService = new LogService(client);
    await logService.logMemberLeave(member as GuildMember);
  },
};

export default event;
