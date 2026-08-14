import {ChatInterface} from '@/components/features/chat/chat-interface'

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false

export default function ChatPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="bg-background border-b px-6 py-4">
        <h1 className="text-2xl font-semibold">Chat IA</h1>
        <p className="text-muted-foreground text-sm">
          Conversation avec votre assistant IA local (Ollama)
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <ChatInterface />
      </div>
    </div>
  )
}
