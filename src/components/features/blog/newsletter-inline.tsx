'use client'

import {Mail, Shield} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useState, useTransition} from 'react'

import {subscribeToNewsletterAction} from '@/app/[locale]/(public)/blog/actions'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'

export function NewsletterInline() {
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
    <div className="bg-muted/50 rounded-xl border p-6">
      <div className="flex flex-col items-center gap-4 text-center md:flex-row md:text-left">
        <div className="bg-primary/10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
          <Mail className="text-primary h-6 w-6" />
        </div>
        <div className="flex-1">
          <h3 className="mb-1 font-semibold">{t('newsletter.title')}</h3>
          <p className="text-muted-foreground text-sm">
            {t('newsletter.description')}
          </p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"
        >
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('newsletter.placeholder')}
            className="min-w-[240px]"
            disabled={isPending}
            required
          />
          <Button type="submit" disabled={isPending}>
            {isPending
              ? t('newsletter.subscribing')
              : t('newsletter.subscribe')}
          </Button>
        </form>
      </div>
      {message && (
        <p
          className={`mt-3 text-center text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}
        >
          {message.text}
        </p>
      )}
      <p className="text-muted-foreground mt-3 flex items-center justify-center gap-1 text-xs">
        <Shield className="h-3 w-3" />
        {t('newsletter.privacy')}
      </p>
    </div>
  )
}
