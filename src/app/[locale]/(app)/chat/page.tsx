import {ChatInterface} from '@/components/features/chat/chat-interface'

// Route authentifiée, pas encore migrée. Le layout fait un `await` sur la session à son
// niveau supérieur, ce qui bloque tout le segment. Le pattern officiel existe :
// https://nextjs.org/docs/app/guides/authentication-with-cache-components
// (session en 'use cache: private', promesse passée au provider, use() derrière Suspense).
// Voir D17 dans docs/plans/cache-components-migration.md.
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
