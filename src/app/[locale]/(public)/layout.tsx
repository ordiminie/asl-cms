import Link from 'next/link'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {PropsWithChildren} from 'react'

import PublicFooter from '@/components/features/layouts/public-footer'
import {PublicMobileMenu} from '@/components/features/layouts/public-mobile-menu'
import {LangToggle} from '@/components/lang-toggle'
import {ModeToggle} from '@/components/theme-toggle'
import {Button} from '@/components/ui/button'
import {PagesConst} from '@/env'
import {routing} from '@/i18n/routing'
import {isPageEnabled} from '@/lib/utils'

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

export default function PublicLayout({children}: PropsWithChildren) {
  return (
    <div className="flex h-screen flex-col">
      <header className="border-b">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex h-14 items-center justify-center">
            <div className="flex flex-1 items-center justify-start space-x-4">
              <Link className="flex items-center space-x-2 font-bold" href="/">
                <span>Home</span>
              </Link>
              <Link
                className="hidden items-center space-x-2 font-bold sm:flex"
                href="/privacy"
              >
                <span>Privacy</span>
              </Link>

              <Link
                className="hidden items-center space-x-2 font-bold sm:flex"
                href="/terms"
              >
                <span>Terms</span>
              </Link>
              {isPageEnabled(PagesConst.DOCS) && (
                <Link
                  className="hidden items-center space-x-2 font-bold sm:flex"
                  href="/docs"
                >
                  <span>Docs</span>
                </Link>
              )}
              {isPageEnabled(PagesConst.BLOG) && (
                <Link
                  className="hidden items-center space-x-2 font-bold sm:flex"
                  href="/blog"
                >
                  <span>Blog</span>
                </Link>
              )}
            </div>

            <div className="flex flex-1 items-center justify-end space-x-2">
              <div className="flex items-center gap-2">
                <LangToggle />
                <Button asChild className="hidden sm:flex">
                  <Link href="/login">Connexion</Link>
                </Button>
                <div className="sm:hidden">
                  <PublicMobileMenu />
                </div>

                <ModeToggle />
              </div>
            </div>
          </nav>
        </div>
      </header>

      <main className="w-full flex-1">{children}</main>

      <PublicFooter />
    </div>
  )
}
