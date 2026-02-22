import type { AIProvider, ChatMessage, MCPTool, AIResponse, ToolCall } from "./provider.js";

export class OpenAIProvider implements AIProvider {
  name = "openai";
  private model: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(model: string) {
    this.model = model;
    this.apiKey = process.env["OPENAI_API_KEY"] ?? "";
    this.baseUrl = process.env["OPENAI_BASE_URL"] ?? "https://api.openai.com/v1";
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
      body.tools = tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${error}`);
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

    const choice = data.choices[0];
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
