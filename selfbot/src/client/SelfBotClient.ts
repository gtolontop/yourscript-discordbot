import { Client } from "discord.js-selfbot-v13";
import { logger } from "../utils/logger.js";

export class SelfBotClient extends Client {
  private dmHandlers: Array<(message: any) => void> = [];
  private threadHandlers: Array<(message: any) => void> = [];

  constructor() {
    super({
      checkUpdate: false,
    } as any);
  }

  onDirectMessage(handler: (message: any) => void): void {
    this.dmHandlers.push(handler);
  }

  onThreadMessage(handler: (message: any) => void): void {
    this.threadHandlers.push(handler);
  }

  async start(token: string): Promise<void> {
    logger.info("Connecting selfbot to Discord...");

    this.on("ready", () => {
      logger.info(`Selfbot logged in as ${this.user?.tag}`);
    });

    this.on("error", (error) => {
      logger.error("Selfbot error:", error);
    });

    this.on("messageCreate", (message: any) => {
      if (message.author.id === this.user?.id) return;
      if (message.author.bot) return;

      if (!message.guild) {
        // DM → route to dmHandlers
        this.dmHandlers.forEach((h) => h(message));
      } else if (message.channel.isThread?.()) {
        // Thread → route to threadHandlers
        this.threadHandlers.forEach((h) => h(message));
      }
    });

    await this.login(token);
  }

  async stop(): Promise<void> {
    logger.info("Disconnecting selfbot...");
    this.destroy();
    logger.info("Selfbot stopped");
  }
}
