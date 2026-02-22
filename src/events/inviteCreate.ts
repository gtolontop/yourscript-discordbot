import { Invite } from "discord.js";
import type { Event } from "../types/index.js";
import { LogService } from "../services/LogService.js";
import { logger } from "../utils/index.js";

const event: Event<"inviteCreate"> = {
  name: "inviteCreate",
  async execute(client, invite: Invite) {
    if (!invite.guild) return;

    logger.event(`Invite created: ${invite.code} by ${invite.inviter?.tag ?? "Unknown"} | ${invite.guild.name}`);

    const logService = new LogService(client);
    await logService.logInviteCreate(invite);
  },
};

export default event;
