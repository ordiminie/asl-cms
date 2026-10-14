import {Metadata} from 'next'
import Link from 'next/link'
import {getTranslations} from 'next-intl/server'
import React from 'react'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {AssociationMark} from '@/components/features/association/association-mark'
import LogoutButton from '@/components/features/auth/forms/logout-button'
import {NO_INDEX_ROBOTS} from '@/lib/seo/resolve-metadata'
import {getIdentityVersionFromKey} from '@/services/types/domain/association-identity-types'

export const metadata: Metadata = {
  title: 'Espace membre',
  robots: NO_INDEX_ROBOTS,
}

/**
 * Coquille de l'espace membre (design system §3.12) : l'identite de
 * l'association et la deconnexion, rien d'autre. La session n'est jamais
 * attendue ici ; le tenant, lui, est deja resolu en bloquant par le layout
 * `[locale]` (ADR 003) et `cache()` dedoublonne la lecture.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [tenant, t] = await Promise.all([
    requireCurrentTenantDal(),
    getTranslations('MemberSpaceLayout'),
  ])

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <a
        href="#contenu"
        className="bg-primary text-primary-foreground focus-visible:outline-ring sr-only rounded-md px-4 py-3 font-semibold underline focus:not-sr-only focus:absolute focus:top-2 focus:left-4 focus:z-50 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {t('skipToContent')}
      </a>
      <header className="bg-background border-b">
        <div className="mx-auto flex w-full max-w-[1000px] items-center justify-between gap-4 px-4 py-3 sm:py-4 lg:px-0">
          <Link href="/" className="min-w-0">
            <AssociationMark
              name={tenant.name}
              logoVersion={getIdentityVersionFromKey(tenant.logoKey)}
              size="public"
              className="min-w-0 [&>span:last-child]:line-clamp-2"
            />
          </Link>
          <LogoutButton
            variant="outline"
            withIcon
            className="h-14 shrink-0 sm:h-12"
          />
        </div>
      </header>
      <main
        id="contenu"
        className="mx-auto w-full max-w-[1000px] flex-1 px-4 pt-8 pb-12 lg:px-0"
      >
        {children}
      </main>
    </div>
  )
}
