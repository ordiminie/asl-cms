'use client'

import {Shield} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useState, useTransition} from 'react'

import {subscribeToNewsletterAction} from '@/app/[locale]/(public)/blog/actions'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'

export function NewsletterForm() {
  const t = useTranslations('BlogLayout')
  const [email, setEmail] = useState('')
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    startTransition(async () => {
      const result = await subscribeToNewsletterAction(email)
      if (result.success) {
        setMessage({type: 'success', text: t('newsletter.success')})
        setEmail('')
      } else {
        setMessage({
          type: 'error',
          text: result.error || t('newsletter.error'),
        })
      }
    })
  }

  return (
    <Card className="from-primary/5 to-primary/10 border-primary/20 bg-gradient-to-br">
      <CardHeader>
        <CardTitle className="text-lg">{t('newsletter.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">
          {t('newsletter.description')}
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('newsletter.placeholder')}
            className="bg-background/50 rounded-md border px-3 py-2 text-sm backdrop-blur"
            disabled={isPending}
            required
          />
          <button
            type="submit"
            disabled={isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-2 text-sm transition-colors disabled:opacity-50"
          >
            {isPending
              ? t('newsletter.subscribing')
              : t('newsletter.subscribe')}
          </button>
        </form>
        {message && (
          <p
            className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}
          >
            {message.text}
          </p>
        )}
        <p className="text-muted-foreground flex items-center gap-1 text-xs">
          <Shield className="h-3 w-3" />
          {t('newsletter.privacy')}
        </p>
      </CardContent>
    </Card>
  )
}
