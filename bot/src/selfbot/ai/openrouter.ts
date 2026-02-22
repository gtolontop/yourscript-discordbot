import type { AIProvider, ChatMessage, MCPTool, AIResponse, ToolCall } from "./provider.js";

export class OpenRouterProvider implements AIProvider {
  name = "openrouter";
  private model: string;
  private apiKey: string;
  private siteUrl: string;
  private siteName: string;

  constructor(model: string) {
    this.model = model;
    this.apiKey = process.env["OPENROUTER_API_KEY"] ?? "";
    this.siteUrl = process.env["OPENROUTER_SITE_URL"] ?? "https://discord-bot.local";
    this.siteName = process.env["OPENROUTER_SITE_NAME"] ?? "Discord Bot AI";
  }

  async chat(messages: ChatMessage[], tools?: MCPTool[]): Promise<AIResponse> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.name ? { name: m.name } : {}),
        ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
      })),
      max_tokens: 2048,
    };

    if (tools && tools.length > 0) {
      body["tools"] = tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
        "HTTP-Referer": this.siteUrl,
        "X-Title": this.siteName,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error ${response.status}: ${error}`);
    }

    const data = (await response.json()) as {
      choices: Array<{
        message: {
          content: string | null;
          tool_calls?: Array<{
            id: string;
            function: { name: string; arguments: string };
          }>;
        };
      }>;
    };

    const choice = data.choices[0]!;
    const toolCalls: ToolCall[] | undefined = choice.message.tool_calls?.map(
      (tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      })
    );

    return {
      content: choice.message.content ?? "",
      toolCalls,
    };
  }
}
