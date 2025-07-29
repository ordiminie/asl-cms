import {BarChart2, ShieldCheck, Zap} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import {Metadata} from 'next/types'
import {getTranslations, setRequestLocale} from 'next-intl/server'

import ButtonConnexionDashboard from '@/components/features/auth/button-connexion-dashboard'
import PublicFooter from '@/components/features/layouts/public-footer'
import ImageTheme from '@/components/image-theme'
import {LangToggle} from '@/components/lang-toggle'
import {ModeToggle} from '@/components/theme-toggle'
import {Button} from '@/components/ui/button'
import {Component} from '@/components/ui/vapour-text-effect'
import {routing} from '@/i18n/routing'
import {APP_NAME} from '@/lib/constants'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>
}): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'HomePage'})

  return {
    title: t('metadata.title'),
    description: t('metadata.description'),
  }
}

export default async function Home({
  params,
}: {
  params: Promise<{locale: string}>
}) {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations('HomePage')
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-border bg-background/80 relative flex w-full items-center border-b px-4 py-4 backdrop-blur sm:px-6 md:px-8">
        <div className="flex items-center gap-2">
          <ImageTheme
            className="relative z-10"
            src="/next.svg"
            srcDark="/next-inverted.svg"
            alt="App Logo"
            width={32}
            height={32}
            priority
          />
          <span className="hidden text-xl font-bold tracking-tight sm:inline">
            {APP_NAME}
          </span>
        </div>
        <nav className="absolute top-1/2 left-1/2 hidden -translate-x-1/2 -translate-y-1/2 gap-8 text-sm font-medium md:flex">
          <Link href="#features" className="hover:text-primary transition">
            {t('navigation.features')}
          </Link>
          <Link href="/pricing" className="hover:text-primary transition">
            {t('navigation.pricing')}
          </Link>
          <Link href="/contact" className="hover:text-primary transition">
            {t('navigation.contact')}
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <LangToggle />
          <ButtonConnexionDashboard />
          <ModeToggle />
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center px-4 py-12 text-center sm:px-6 md:px-8 lg:py-16">
        <h1 className="mx-auto mb-6 max-w-4xl text-4xl leading-tight font-bold sm:text-5xl md:text-6xl">
          {t('hero.title')}
        </h1>
        <Component />
        <p className="text-muted-foreground mb-8 max-w-2xl text-lg sm:text-xl">
          {t('hero.description')}
        </p>
        <Button size="lg" className="mb-8">
          <Link href="/register">{t('hero.cta')}</Link>
        </Button>
      </section>

      {/* Product Image */}
      <section className="px-4 sm:px-6 md:px-8">
        <div className="mx-auto mb-16 flex max-w-5xl justify-center">
          <div className="border-border bg-muted w-full overflow-hidden rounded-xl border shadow-lg">
            <Image
              src="/images/product-2.avif"
              alt="Aperçu du produit"
              width={1200}
              height={600}
              className="h-auto w-full"
              priority
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="px-4 sm:px-6 md:px-8">
        <div className="mx-auto mb-16 max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
              {t('features.title')}
            </h2>
            <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
              {t('features.subtitle')}
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="bg-background border-border flex flex-col rounded-xl border p-6 text-center shadow-sm sm:p-8">
              <Zap className="text-primary mx-auto mb-4" size={40} />
              <h3 className="mb-3 text-lg font-semibold">
                {t('features.automation.title')}
              </h3>
              <p className="text-muted-foreground text-sm sm:text-base">
                {t('features.automation.description')}
              </p>
            </div>
            <div className="bg-background border-border flex flex-col rounded-xl border p-6 text-center shadow-sm sm:p-8">
              <BarChart2 className="text-primary mx-auto mb-4" size={40} />
              <h3 className="mb-3 text-lg font-semibold">
                {t('features.analytics.title')}
              </h3>
              <p className="text-muted-foreground text-sm sm:text-base">
                {t('features.analytics.description')}
              </p>
            </div>
            <div className="bg-background border-border flex flex-col rounded-xl border p-6 text-center shadow-sm sm:col-span-2 sm:p-8 lg:col-span-1">
              <ShieldCheck className="text-primary mx-auto mb-4" size={40} />
              <h3 className="mb-3 text-lg font-semibold">
                {t('features.security.title')}
              </h3>
              <p className="text-muted-foreground text-sm sm:text-base">
                {t('features.security.description')}
              </p>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
