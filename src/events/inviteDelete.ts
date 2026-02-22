import { Invite } from "discord.js";
import type { Event } from "../types/index.js";
import { LogService } from "../services/LogService.js";
import { logger } from "../utils/index.js";

const event: Event<"inviteDelete"> = {
  name: "inviteDelete",
  async execute(client, invite: Invite) {
    if (!invite.guild) return;

    logger.event(`Invite deleted: ${invite.code} | ${invite.guild.name}`);

    const logService = new LogService(client);
    await logService.logInviteDelete(invite);
  },
};

export default event;
