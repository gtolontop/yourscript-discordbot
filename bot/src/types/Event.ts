import type { ClientEvents } from "discord.js";
import type { Bot } from "../client/Bot.js";

export interface Event<K extends keyof ClientEvents = keyof ClientEvents> {
  name: K;
  once?: boolean;
  execute(client: Bot, ...args: ClientEvents[K]): Promise<void>;
}
