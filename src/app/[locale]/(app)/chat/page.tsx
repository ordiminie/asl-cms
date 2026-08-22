import {useTranslations} from 'next-intl'

import {ChatInterface} from '@/components/features/chat/chat-interface'

export default function ChatPage() {
  const t = useTranslations('Chat')
  return (
    <div className="flex h-full flex-col">
      <div className="bg-background border-b px-6 py-4">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-muted-foreground text-sm">{t('description')}</p>
      </div>
      <div className="min-h-0 flex-1">
        <ChatInterface />
      </div>
    </div>
  )
}
