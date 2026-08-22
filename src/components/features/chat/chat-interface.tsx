'use client'

import {Loader2, Send} from 'lucide-react'
import {useTranslations} from 'next-intl'
import React, {useEffect, useRef, useState} from 'react'

import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {cn} from '@/lib/utils'

import {MessageContent} from './message-content'

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
}

export function ChatInterface() {
  const t = useTranslations('Chat')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(
    null
  )
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({behavior: 'smooth'})
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input.trim(),
      role: 'user',
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      content: '',
      role: 'assistant',
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, assistantMessage])
    setStreamingMessageId(assistantMessage.id)

    try {
      abortControllerRef.current = new AbortController()

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: userMessage.content,
          model: 'llama3.2',
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error(`Erreur Ollama: ${response.status}`)
      }

      if (!response.body) {
        throw new Error('Pas de réponse du serveur')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const {done, value} = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, {stream: true})
        const lines = chunk.split('\n').filter((line) => line.trim())

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.content) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessage.id
                      ? {...msg, content: msg.content + data.content}
                      : msg
                  )
                )
              }
              if (data.done) {
                break
              }
            } catch (error) {
              console.warn('Erreur parsing SSE:', error)
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }

      console.error('Erreur envoi message:', error)
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessage.id
            ? {
                ...msg,
                content:
                  'Erreur: Impossible de communiquer avec le serveur de chat. (installez Ollama et run "ollama serve")',
              }
            : msg
        )
      )
    } finally {
      setIsLoading(false)
      setStreamingMessageId(null)
      abortControllerRef.current = null
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsLoading(false)
      setStreamingMessageId(null)
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center">
            <h3 className="mb-2 text-lg font-medium">{t('welcome')}</h3>
            <p>{t('welcomeHint')}</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex w-full',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[80%] rounded-lg px-4 py-2',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground break-words whitespace-pre-wrap'
                    : 'bg-muted text-foreground border'
                )}
              >
                {message.role === 'user' ? (
                  <span className="break-words whitespace-pre-wrap">
                    {message.content}
                  </span>
                ) : (
                  <>
                    {message.content ? (
                      <MessageContent
                        content={message.content}
                        isStreaming={streamingMessageId === message.id}
                      />
                    ) : (
                      isLoading && (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-muted-foreground text-sm">
                            {t('thinking')}
                          </span>
                        </div>
                      )
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-background border-t p-4">
        <div className="flex gap-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('placeholder')}
            disabled={isLoading}
            className="flex-1"
          />
          {isLoading ? (
            <Button
              onClick={stopGeneration}
              variant="outline"
              size="icon"
              className="shrink-0"
            >
              <Loader2 className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={sendMessage}
              disabled={!input.trim()}
              size="icon"
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
