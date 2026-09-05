import {notFound} from 'next/navigation'
import {Metadata} from 'next/types'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {env} from '@/env'

import ResetPasswordPage from './reset'

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>
}): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'Auth.ResetPasswordPage'})

  return {
    title: t('metadata.title'),
    description: t('metadata.description'),
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{locale: string}>
}) {
  const {locale} = await params
  setRequestLocale(locale)

  // Vérifier si credential est activé
  if (!env.NEXT_PUBLIC_AUTH_METHODS.includes('credential')) {
    notFound()
  }

  return (
    <Suspense>
      <ResetPasswordPage />
    </Suspense>
  )
}
