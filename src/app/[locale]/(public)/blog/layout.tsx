import {ArrowRight, Sparkles} from 'lucide-react'
import Link from 'next/link'
import {notFound} from 'next/navigation'
import {getTranslations} from 'next-intl/server'
import React from 'react'

import {NewsletterInline} from '@/components/features/blog/newsletter-inline'
import {Button} from '@/components/ui/button'
import {PagesConst} from '@/env'
import {isPageEnabled} from '@/lib/utils'

export default async function BlogLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{locale: string}>
}) {
  if (!isPageEnabled(PagesConst.BLOG)) {
    return notFound()
  }
  const {locale} = await params
  const t = await getTranslations({locale, namespace: 'BlogLayout'})

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <main>{children}</main>

        <section className="from-primary/5 via-primary/10 to-primary/5 mt-20 rounded-2xl border bg-gradient-to-br p-8 text-center md:p-12">
          <div className="mx-auto max-w-2xl">
            <div className="bg-primary/10 mb-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5">
              <Sparkles className="text-primary h-4 w-4" />
              <span className="text-primary text-sm font-medium">
                {t('cta.badge')}
              </span>
            </div>
            <h2 className="mb-4 text-2xl font-bold md:text-3xl">
              {t('cta.titleStart')}{' '}
              <span className="text-primary">{t('cta.titleHighlight')}</span>{' '}
              {t('cta.titleEnd')}
            </h2>
            <p className="text-muted-foreground mb-6">{t('cta.description')}</p>
            <Button size="lg" asChild>
              <Link href={`/${locale}/register`}>
                {t('cta.button')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <p className="text-muted-foreground mt-4 text-sm">
              {t('cta.disclaimer')}
            </p>
          </div>
        </section>

        <section className="mt-12">
          <NewsletterInline />
        </section>
      </div>
    </div>
  )
}
