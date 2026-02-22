import { Client, GatewayIntentBits, Partials, Message } from "discord.js";
import { AIProvider, createProvider } from "./ai/provider.js";
import { MCPClient } from "./mcp/client.js";
import { ContextManager } from "./ai/context.js";
import { MessageHandler } from "./handlers/messageHandler.js";
import { logger } from "../utils/logger.js";

export class SelfBot {
  public client: Client;
  public ai: AIProvider;
  public mcp: MCPClient;
  public context: ContextManager;
  private handler: MessageHandler;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
      partials: [Partials.Channel, Partials.Message],
    });

    const aiModel = process.env["AI_MODEL"] ?? "gpt-4o";
    const aiProvider = process.env["AI_PROVIDER"] ?? "openai";
    this.ai = createProvider(aiProvider, aiModel);

    const mcpHost = process.env["MCP_HOST"] ?? "127.0.0.1";
    const mcpPort = parseInt(process.env["MCP_PORT"] ?? "9100");
    this.mcp = new MCPClient(mcpHost, mcpPort);

    this.context = new ContextManager();
    this.handler = new MessageHandler(this);

    this.client.on("messageCreate", (msg: Message) => this.handler.handle(msg));
    this.client.on("ready", () => {
      logger.info(`SelfBot logged in as ${this.client.user?.tag}`);
    });
  }

  async start(): Promise<void> {
    const token = process.env["SELFBOT_TOKEN"];
    if (!token) {
      logger.warn("SELFBOT_TOKEN not set, selfbot disabled");
      return;
    }

    try {
      await this.mcp.connect();
      logger.info("MCP client connected to backend");
    } catch (error) {
      logger.warn("MCP connection failed, selfbot will run without tools:", error);
    }

    await this.client.login(token);
  }

  async stop(): Promise<void> {
    this.mcp.disconnect();
    this.client.destroy();
  }
}
