import type { Message, TextChannel } from "discord.js";
import type { SelfBot } from "../SelfBot.js";
import type { ChatMessage, ToolCall } from "../ai/provider.js";
import { buildSystemPrompt } from "../ai/personality.js";
import { logger } from "../../utils/logger.js";

type TriggerMode = "mention" | "always" | "keyword" | "ticket";

export class MessageHandler {
  private selfbot: SelfBot;

  constructor(selfbot: SelfBot) {
    this.selfbot = selfbot;
  }

  async handle(message: Message): Promise<void> {
    // Ignore own messages and bot messages
    if (
      message.author.id === this.selfbot.client.user?.id ||
      message.author.bot
    ) {
      return;
    }

    // Only handle guild messages for now
    if (!message.guild) return;

    try {
      const shouldRespond = await this.shouldRespond(message);
      if (!shouldRespond) return;

      // Add the user's message to context
      this.selfbot.context.addMessage(message.channelId, {
        role: "user",
        content: `${message.author.username}: ${message.content}`,
      });

      // Build system prompt
      const systemPrompt = buildSystemPrompt(
        message.guild.name
      );

      // Get conversation context
      const contextMessages = this.selfbot.context.getMessages(message.channelId);
      const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        ...contextMessages,
      ];

      // Get MCP tools if connected
      const tools = this.selfbot.mcp.isConnected()
        ? this.selfbot.mcp.getTools()
        : [];

      // Start typing
      const channel = message.channel as TextChannel;
      await channel.sendTyping();

      // Call AI with tool loop
      let response = await this.selfbot.ai.chat(messages, tools);

      // Handle tool calls (max 5 iterations to prevent infinite loops)
      let iterations = 0;
      while (response.toolCalls && response.toolCalls.length > 0 && iterations < 5) {
        iterations++;

        for (const toolCall of response.toolCalls) {
          logger.info(`MCP tool call: ${toolCall.name}`);
          try {
            const result = await this.selfbot.mcp.callTool(
              toolCall.name,
              toolCall.arguments
            );

            messages.push({
              role: "assistant",
              content: response.content || "",
            });
            messages.push({
              role: "tool",
              content: result,
              tool_call_id: toolCall.id,
              name: toolCall.name,
            });
          } catch (error) {
            messages.push({
              role: "tool",
              content: `Tool error: ${error}`,
              tool_call_id: toolCall.id,
              name: toolCall.name,
            });
          }
        }

        // Continue the conversation with tool results
        response = await this.selfbot.ai.chat(messages, tools);
      }

      // Send the final response
      if (response.content) {
        // Split long messages
        const chunks = this.splitMessage(response.content);
        for (const chunk of chunks) {
          await channel.send(chunk);
        }

        // Add assistant response to context
        this.selfbot.context.addMessage(message.channelId, {
          role: "assistant",
          content: response.content,
        });
      }
    } catch (error) {
      logger.error("Selfbot message handling error:", error);
    }
  }

  private async shouldRespond(message: Message): Promise<boolean> {
    if (!message.guild) return false;

    // Check if selfbot is mentioned
    const selfId = this.selfbot.client.user?.id;
    if (selfId && message.mentions.has(selfId)) {
      return true;
    }

    // For more advanced trigger modes, we'd fetch guild config from the backend
    // For now, only respond to mentions
    // TODO: Implement keyword, always, and ticket trigger modes using guild config
    // from the backend (ai_enabled, ai_channels, ai_trigger_mode)

    return false;
  }

  private splitMessage(content: string, maxLength = 2000): string[] {
    if (content.length <= maxLength) return [content];

    const chunks: string[] = [];
    let remaining = content;

    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining);
        break;
      }

      // Try to split at a newline
      let splitAt = remaining.lastIndexOf("\n", maxLength);
      if (splitAt === -1 || splitAt < maxLength / 2) {
        // Try to split at a space
        splitAt = remaining.lastIndexOf(" ", maxLength);
      }
      if (splitAt === -1 || splitAt < maxLength / 2) {
        splitAt = maxLength;
      }

      chunks.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt).trimStart();
    }

    return chunks;
  }
}
