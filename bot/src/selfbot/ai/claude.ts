import type { AIProvider, ChatMessage, MCPTool, AIResponse, ToolCall } from "./provider.js";

export class ClaudeProvider implements AIProvider {
  name = "claude";
  private model: string;
  private apiKey: string;

  constructor(model: string) {
    this.model = model;
    this.apiKey = process.env["ANTHROPIC_API_KEY"] ?? "";
  }

  async chat(messages: ChatMessage[], tools?: MCPTool[]): Promise<AIResponse> {
    const systemMessage = messages.find((m) => m.role === "system");
    const filteredMessages = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "tool" ? "user" : m.role,
        content:
          m.role === "tool"
            ? [
                {
                  type: "tool_result",
                  tool_use_id: m.tool_call_id,
                  content: m.content,
                },
              ]
            : m.content,
      }));

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: 2048,
      messages: filteredMessages,
    };

    if (systemMessage) {
      body.system = systemMessage.content;
    }

    if (tools && tools.length > 0) {
      body.tools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error ${response.status}: ${error}`);
    }

    const data = (await response.json()) as {
      content: Array<{
        type: string;
        text?: string;
        id?: string;
        name?: string;
        input?: Record<string, unknown>;
      }>;
    };

    let content = "";
    const toolCalls: ToolCall[] = [];

    for (const block of data.content) {
      if (block.type === "text" && block.text) {
        content += block.text;
      }
      if (block.type === "tool_use" && block.id && block.name && block.input) {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input,
        });
      }
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }
}
