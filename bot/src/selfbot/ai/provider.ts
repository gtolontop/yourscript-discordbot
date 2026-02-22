export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AIResponse {
  content: string;
  toolCalls?: ToolCall[];
}

export interface AIProvider {
  name: string;
  chat(messages: ChatMessage[], tools?: MCPTool[]): Promise<AIResponse>;
}

export function createProvider(name: string, model: string): AIProvider {
  switch (name.toLowerCase()) {
    case "openai":
    case "gpt": {
      const { OpenAIProvider } = require("./openai.js");
      return new OpenAIProvider(model);
    }
    case "gemini":
    case "google": {
      const { GeminiProvider } = require("./gemini.js");
      return new GeminiProvider(model);
    }
    case "claude":
    case "anthropic": {
      const { ClaudeProvider } = require("./claude.js");
      return new ClaudeProvider(model);
    }
    case "openrouter": {
      const { OpenRouterProvider } = require("./openrouter.js");
      return new OpenRouterProvider(model);
    }
    default:
      throw new Error(`Unknown AI provider: ${name}`);
  }
}
