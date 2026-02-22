import * as net from "net";
import type { MCPTool } from "../ai/provider.js";
import { logger } from "../../utils/logger.js";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

export class MCPClient {
  private host: string;
  private port: number;
  private socket: net.Socket | null = null;
  private requestId = 0;
  private pendingRequests: Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  > = new Map();
  private buffer = "";
  private tools: MCPTool[] = [];
  private connected = false;

  constructor(host: string, port: number) {
    this.host = host;
    this.port = port;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();

      this.socket.on("connect", async () => {
        this.connected = true;
        logger.info(`MCP client connected to ${this.host}:${this.port}`);

        try {
          // Initialize MCP session
          await this.send("initialize", {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "discord-selfbot", version: "1.0.0" },
          });

          // Fetch available tools
          const toolsResult = (await this.send("tools/list", {})) as {
            tools: MCPTool[];
          };
          this.tools = toolsResult.tools ?? [];
          logger.info(`MCP tools loaded: ${this.tools.map((t) => t.name).join(", ")}`);

          resolve();
        } catch (error) {
          reject(error);
        }
      });

      this.socket.on("data", (data: Buffer) => {
        this.buffer += data.toString();
        this.processBuffer();
      });

      this.socket.on("error", (err) => {
        logger.error("MCP socket error:", err);
        this.connected = false;
        reject(err);
      });

      this.socket.on("close", () => {
        this.connected = false;
        logger.info("MCP connection closed");
      });

      this.socket.connect(this.port, this.host);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getTools(): MCPTool[] {
    return [...this.tools];
  }

  async callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<string> {
    const result = (await this.send("tools/call", { name, arguments: args })) as {
      content: Array<{ type: string; text: string }>;
    };

    return (
      result.content
        ?.filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("\n") ?? ""
    );
  }

  private send(
    method: string,
    params?: Record<string, unknown>
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error("MCP client not connected"));
        return;
      }

      const id = ++this.requestId;
      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        id,
        method,
        params,
      };

      this.pendingRequests.set(id, { resolve, reject });

      const message = JSON.stringify(request) + "\n";
      this.socket.write(message);

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`MCP request timeout: ${method}`));
        }
      }, 30000);
    });
  }

  private processBuffer(): void {
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const response = JSON.parse(line) as JsonRpcResponse;
        const pending = this.pendingRequests.get(response.id);
        if (pending) {
          this.pendingRequests.delete(response.id);
          if (response.error) {
            pending.reject(
              new Error(`MCP error: ${response.error.message}`)
            );
          } else {
            pending.resolve(response.result);
          }
        }
      } catch {
        logger.warn("Failed to parse MCP response:", line);
      }
    }
  }
}
