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
import type { Namespace } from "socket.io";
import type { Command, ButtonComponent, ModalComponent, SelectMenuComponent } from "../types/index.js";
import { logger } from "../utils/index.js";

export class Bot extends Client {
  public commands: Collection<string, Command> = new Collection();
  public buttons: Collection<string, ButtonComponent> = new Collection();
  public modals: Collection<string, ModalComponent> = new Collection();
  public selectMenus: Collection<string, SelectMenuComponent> = new Collection();
  public cooldowns: Collection<string, Collection<string, number>> = new Collection();
  public db: PrismaClient;
  public player: Player;
  public aiNamespace: Namespace | null = null;

  constructor(options?: Partial<ClientOptions>) {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildInvites,
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
    logger.db("Connecting to database...");
    await this.db.$connect();
    logger.db("Database connected");

    logger.info("Loading music extractors...");
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

    logger.info("Music extractors loaded (Spotify, SoundCloud, Apple Music, YouTube, Attachment)");

    logger.info("Connecting to Discord...");
    await this.login(token);
  }

  async stop(): Promise<void> {
    logger.info("Disconnecting database...");
    await this.db.$disconnect();
    logger.info("Destroying Discord client...");
    this.destroy();
    logger.info("Bot stopped gracefully");
  }
}
