import {ChatInterface} from '@/components/features/chat/chat-interface'

// Route authentifiée : le layout lit la session via getAuthUser() -> headers() et la
// passe à AuthProvider, qui enveloppe tout l'arbre. Aucun enfant à isoler dans un
// <Suspense> — c'est le cas que la doc Next appelle « no child to wrap ». Lever cet
// opt-out demande de revoir comment AuthProvider obtient l'utilisateur (D16).
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
