import {getTranslations, setRequestLocale} from 'next-intl/server'
import {PropsWithChildren} from 'react'

import {routing} from '@/i18n/routing'

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>
}) {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'AuthLayout'})

  return {
    title: t('title'),
    description: t('description'),
  }
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}))
}
export default function AuthLayout({children}: PropsWithChildren) {
  return (
    <div className="bg-muted/10 dark:bg-background flex min-h-screen flex-col">
      {/* En-tête avec navigation */}

      {/* Contenu principal centré */}
      <main className="bg-muted flex flex-1 items-center justify-center">
        <div className="w-full max-w-md px-4 py-8">{children}</div>
      </main>

      {/* Pied de page simple */}
    </div>
  )
}
