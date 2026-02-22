import {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  type ClientOptions,
} from "discord.js";
import { Player } from "discord-player";
import {
  SpotifyExtractor,
  SoundCloudExtractor,
  AppleMusicExtractor,
  AttachmentExtractor,
} from "@discord-player/extractor";
import { YoutubeiExtractor } from "discord-player-youtubei";
import { BackendClient } from "../api/client.js";
import { logger } from "../utils/logger.js";
import type {
  Command,
  ButtonComponent,
  ModalComponent,
  SelectMenuComponent,
} from "../types/index.js";

export class Bot extends Client {
  public commands: Collection<string, Command> = new Collection();
  public buttons: Collection<string, ButtonComponent> = new Collection();
  public modals: Collection<string, ModalComponent> = new Collection();
  public selectMenus: Collection<string, SelectMenuComponent> =
    new Collection();
  public cooldowns: Collection<string, Collection<string, number>> =
    new Collection();
  public api: BackendClient;
  public player: Player;

  constructor(options?: Partial<ClientOptions>) {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration,
      ],
      partials: [Partials.Channel, Partials.GuildMember, Partials.Message],
      ...options,
    });

    const backendUrl = process.env["BACKEND_URL"] ?? "http://localhost:3000";
    const apiKey = process.env["BOT_API_KEY"];

    if (!apiKey) {
      throw new Error("BOT_API_KEY is not set in environment variables");
    }

    this.api = new BackendClient(backendUrl, apiKey);
    this.player = new Player(this, {
      skipFFmpeg: false,
    });
  }

  async start(token: string): Promise<void> {
    // Verify backend connectivity
    try {
      await this.api.getBotConfig();
      logger.info("Backend API connected");
    } catch (error) {
      logger.error("Failed to connect to backend API:", error);
      throw error;
    }

    // Load music extractors
    await this.player.extractors.loadMulti([
      SpotifyExtractor,
      SoundCloudExtractor,
      AppleMusicExtractor,
      AttachmentExtractor,
    ]);

    await this.player.extractors.register(YoutubeiExtractor, {
      streamOptions: {
        useClient: "ANDROID",
      },
    });

    logger.info("Music extractors loaded");

    await this.login(token);
  }

  async stop(): Promise<void> {
    this.destroy();
  }
}
