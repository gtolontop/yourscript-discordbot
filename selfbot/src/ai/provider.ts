export interface AIMessage {
  role: "user" | "model";
  content: string;
}

export interface AIResponse {
  text: string;
  model: string;
  tokensUsed?: number;
}

export interface EmbeddingResponse {
  embedding: number[];
  model: string;
}

export interface AIProvider {
  generateText(
    systemPrompt: string,
    messages: AIMessage[],
    options?: { model?: string; temperature?: number; maxTokens?: number }
  ): Promise<AIResponse>;

  generateEmbedding(text: string): Promise<EmbeddingResponse>;

  classifyText(
    text: string,
    categories: string[],
    context?: string
  ): Promise<{ category: string; confidence: number }>;

  analyzeSentiment(text: string): Promise<{ sentiment: "positive" | "negative" | "neutral" | "frustrated"; score: number }>;

  summarize(text: string, maxLength?: number): Promise<string>;
}
