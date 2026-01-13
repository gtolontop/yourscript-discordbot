import {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  type ClientOptions,
} from "discord.js";
import { PrismaClient } from "@prisma/client";
import { Player } from "discord-player";
import { SpotifyExtractor, SoundCloudExtractor, AppleMusicExtractor, AttachmentExtractor } from "@discord-player/extractor";
import { YoutubeiExtractor } from "discord-player-youtubei";
import type { Command, ButtonComponent, ModalComponent, SelectMenuComponent } from "../types/index.js";

export class Bot extends Client {
  public commands: Collection<string, Command> = new Collection();
  public buttons: Collection<string, ButtonComponent> = new Collection();
  public modals: Collection<string, ModalComponent> = new Collection();
  public selectMenus: Collection<string, SelectMenuComponent> = new Collection();
  public cooldowns: Collection<string, Collection<string, number>> = new Collection();
  public db: PrismaClient;
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

    this.db = new PrismaClient();
    this.player = new Player(this, {
      skipFFmpeg: false,
    });
  }

  async start(token: string): Promise<void> {
    await this.db.$connect();
    console.log("✓ Database connected");

    // Load extractors
    await this.player.extractors.loadMulti([
      SpotifyExtractor,
      SoundCloudExtractor,
      AppleMusicExtractor,
      AttachmentExtractor,
    ]);

    // Register Youtubei for YouTube (more stable than default)
    await this.player.extractors.register(YoutubeiExtractor, {
      streamOptions: {
        useClient: "ANDROID",
      },
    });

    console.log("✓ Music extractors loaded");

    await this.login(token);
  }

  async stop(): Promise<void> {
    await this.db.$disconnect();
    this.destroy();
  }
}
