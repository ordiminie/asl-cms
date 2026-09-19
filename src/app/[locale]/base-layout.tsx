import {GoogleAnalytics} from '@next/third-parties/google'
import {JetBrains_Mono, Public_Sans, Source_Serif_4} from 'next/font/google'
import {NextIntlClientProvider} from 'next-intl'
import {setRequestLocale} from 'next-intl/server'
import NextTopLoader from 'nextjs-toploader'
import React, {CSSProperties, ReactNode} from 'react'

import {AppProviders} from '@/components/context/app-providers'
import {env} from '@/env'
import {
  DEFAULT_ACCENT_HUE,
  isAccentHue,
} from '@/services/types/domain/association-settings-types'

const sans = Public_Sans({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  variable: '--font-public-sans',
})

const serif = Source_Serif_4({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '600', '700'],
  variable: '--font-source-serif',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500'],
  variable: '--font-jetbrains-mono',
})

type Props = {
  children: ReactNode
  locale: string
  /** Teinte d'accent de l'association (s02) ; 195 si absente ou hors liste. */
  accentHue?: number
}

/**
 * La teinte est posee en style en ligne sur `<html>` par le serveur, a partir
 * du tenant resolu : le repli sur que documente le design system (§1.2), plutot
 * que l'`attr()` type au support inegal.
 */
const accentHueStyle = (accentHue?: number) =>
  ({
    '--accent-hue': isAccentHue(accentHue) ? accentHue : DEFAULT_ACCENT_HUE,
  }) as CSSProperties

export default async function BaseLayout({children, locale, accentHue}: Props) {
  // Re-configurer la locale avant getMessages
  setRequestLocale(locale)

  return (
    <html
      lang={locale}
      style={accentHueStyle(accentHue)}
      suppressHydrationWarning
    >
      <body
        className={`${sans.variable} ${serif.variable} ${mono.variable} bg-background text-foreground font-sans text-[17px] leading-[1.6] antialiased`}
      >
        {/* La barre de progression est peinte hors de la cascade CSS : elle ne
            peut pas lire var(--primary). #2C3F63 est la jumelle hexadecimale
            canonique de `primary` (design-system §5.3). */}
        <NextTopLoader showSpinner={false} color="#2C3F63" height={3} />
        <NextIntlClientProvider>
          <AppProviders>{children}</AppProviders>
        </NextIntlClientProvider>
      </body>
      {env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID && (
        <GoogleAnalytics gaId={env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID} />
      )}
    </html>
  )
}
