export interface ChatMessage {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
}

export interface CreateChatMessage {
  content: string
  model?: string
}

export interface ChatProvider {
  sendMessage(
    message: string,
    model?: string
  ): Promise<ReadableStream<Uint8Array>>
}

export type ChatProviderType = 'ollama' | 'openai' | 'anthropic'
