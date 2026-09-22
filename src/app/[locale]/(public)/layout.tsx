import Link from 'next/link'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {PropsWithChildren} from 'react'

import {getCurrentPublicSiteNavigationDal} from '@/app/dal/site-navigation-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {AssociationMark} from '@/components/features/association/association-mark'
import PublicFooter from '@/components/features/layouts/public-footer'
import {PublicMobileMenu} from '@/components/features/layouts/public-mobile-menu'
import {LangToggle} from '@/components/lang-toggle'
import {ModeToggle} from '@/components/theme-toggle'
import {Button} from '@/components/ui/button'
import {routing} from '@/i18n/routing'
import {getIdentityVersionFromKey} from '@/services/types/domain/association-identity-types'

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>
}) {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'PublicLayout'})

  return {
    title: t('title'),
    description: t('description'),
  }
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}))
}

/**
 * Cadre du site public. La zone de navigation porte **le menu compose par le
 * bureau** (s04b, ecran 2) : les entrees laissees visibles dont la page est
 * publiee, dans leur ordre. Menu vide, aucune zone de navigation — pas de
 * conteneur vide. Le tiroir mobile recoit exactement les memes entrees.
 */
export default async function PublicLayout({children}: PropsWithChildren) {
  // Deja resolu par le layout [locale] (bloquant, ADR 003) : `cache()` dedoublonne.
  const [tenant, {menu}, t] = await Promise.all([
    requireCurrentTenantDal(),
    getCurrentPublicSiteNavigationDal(),
    getTranslations('PublicLayout'),
  ])

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-center">
            <div className="flex flex-1 items-center justify-start space-x-4">
              <Link className="flex items-center" href="/">
                <AssociationMark
                  name={tenant.name}
                  logoVersion={getIdentityVersionFromKey(tenant.logoKey)}
                  size="public"
                />
              </Link>
              {menu.length > 0 && (
                <nav
                  aria-label={t('menuLabel')}
                  className="hidden items-center gap-4 sm:flex"
                >
                  {menu.map((entry) => (
                    <Link
                      key={entry.id}
                      className="hover:text-primary text-[15px] transition"
                      href={`/${entry.slug}`}
                    >
                      {entry.title}
                    </Link>
                  ))}
                </nav>
              )}
            </div>

            <div className="flex flex-1 items-center justify-end space-x-2">
              <div className="flex items-center gap-2">
                <LangToggle />
                <Button asChild className="hidden sm:flex">
                  <Link href="/login">Connexion</Link>
                </Button>
                <div className="sm:hidden">
                  <PublicMobileMenu entries={menu} />
                </div>

                <ModeToggle />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full flex-1">{children}</main>

      <PublicFooter />
    </div>
  )
}
