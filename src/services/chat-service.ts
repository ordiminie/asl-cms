import {env} from '@/env'

import {ValidationError} from './errors/validation-error'
import {ChatProvider} from './types/domain/chat-types'
import {chatMessageServiceSchema} from './validation/chat-validation'

class OllamaProvider implements ChatProvider {
  async sendMessage(
    message: string,
    model = 'llama3.2'
  ): Promise<ReadableStream<Uint8Array>> {
    const response = await fetch(`${env.OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt: message,
        stream: true,
      }),
    })

    if (!response.ok) {
      throw new Error(
        `Erreur Ollama: ${response.status} ${response.statusText}`
      )
    }

    if (!response.body) {
      throw new Error('Pas de réponse du serveur Ollama')
    }

    return response.body
  }
}

class OpenAIProvider implements ChatProvider {
  async sendMessage(
    message: string,
    model = 'gpt-3.5-turbo'
  ): Promise<ReadableStream<Uint8Array>> {
    if (!env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY non configurée')
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [{role: 'user', content: message}],
        stream: true,
      }),
    })

    if (!response.ok) {
      throw new Error(
        `Erreur OpenAI: ${response.status} ${response.statusText}`
      )
    }

    if (!response.body) {
      throw new Error('Pas de réponse du serveur OpenAI')
    }

    return response.body
  }
}

class AnthropicProvider implements ChatProvider {
  async sendMessage(
    message: string,
    model = 'claude-3-haiku-20240307'
  ): Promise<ReadableStream<Uint8Array>> {
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY non configurée')
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [{role: 'user', content: message}],
        stream: true,
      }),
    })

    if (!response.ok) {
      throw new Error(
        `Erreur Anthropic: ${response.status} ${response.statusText}`
      )
    }

    if (!response.body) {
      throw new Error('Pas de réponse du serveur Anthropic')
    }

    return response.body
  }
}

export const getChatProvider = (): ChatProvider => {
  switch (env.CHAT_PROVIDER) {
    case 'openai':
      return new OpenAIProvider()
    case 'anthropic':
      return new AnthropicProvider()
    case 'ollama':
    default:
      return new OllamaProvider()
  }
}

export const validateChatMessage = (data: unknown) => {
  const validation = chatMessageServiceSchema.safeParse(data)
  if (!validation.success) {
    throw new ValidationError('Message invalide')
  }
  return validation.data
}

export const parseStreamChunk = (
  chunk: string,
  provider: string
): {content: string; done: boolean} => {
  try {
    switch (provider) {
      case 'ollama': {
        const data = JSON.parse(chunk)
        return {
          content: data.response || '',
          done: data.done || false,
        }
      }
      case 'openai': {
        if (chunk.startsWith('data: ')) {
          const jsonStr = chunk.slice(6)
          if (jsonStr.trim() === '[DONE]') {
            return {content: '', done: true}
          }
          const data = JSON.parse(jsonStr)
          return {
            content: data.choices?.[0]?.delta?.content || '',
            done: false,
          }
        }
        return {content: '', done: false}
      }
      case 'anthropic': {
        if (chunk.startsWith('data: ')) {
          const jsonStr = chunk.slice(6)
          const data = JSON.parse(jsonStr)
          if (data.type === 'content_block_delta') {
            return {
              content: data.delta?.text || '',
              done: false,
            }
          }
          if (data.type === 'message_stop') {
            return {content: '', done: true}
          }
        }
        return {content: '', done: false}
      }
      default:
        return {content: '', done: false}
    }
  } catch (error) {
    console.warn('Erreur parsing chunk:', error)
    return {content: '', done: false}
  }
}
