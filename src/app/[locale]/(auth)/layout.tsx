import {getTranslations, setRequestLocale} from 'next-intl/server'
import {PropsWithChildren} from 'react'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {AssociationMark} from '@/components/features/association/association-mark'
import {routing} from '@/i18n/routing'
import {getIdentityVersionFromKey} from '@/services/types/domain/association-identity-types'

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
/**
 * Cadre des ecrans de connexion (s03) : la page de l'association, sans menu
 * du site — son identite en en-tete, une seule carte centree dessous.
 */
export default async function AuthLayout({children}: PropsWithChildren) {
  // Deja resolu par le layout [locale] (bloquant, ADR 003) : `cache()` dedoublonne.
  const tenant = await requireCurrentTenantDal()

  return (
    <div className="bg-muted flex min-h-screen flex-col">
      <header className="bg-background border-b px-4 py-6 sm:px-11">
        <AssociationMark
          name={tenant.name}
          logoVersion={getIdentityVersionFromKey(tenant.logoKey)}
          size="public"
        />
      </header>

      <main className="flex flex-1 items-start justify-center sm:items-center">
        <div className="w-full max-w-110 px-4 py-8 sm:px-0">{children}</div>
      </main>
    </div>
  )
}
