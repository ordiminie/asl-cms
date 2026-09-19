import {Metadata} from 'next/types'
import {getTranslations, setRequestLocale} from 'next-intl/server'

import {InvalidMagicLink} from '@/components/features/auth/invalid-magic-link'

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>
}): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'Auth.InvalidMagicLink'})

  return {title: t('metadata.title')}
}

/**
 * Ecran C (s03) : cible de l'`errorCallbackURL` du lien magique. Le parametre
 * `error` de Better Auth n'est pas lu : jeton inconnu, deja utilise ou expire
 * menent au meme message.
 */
export default async function InvalidMagicLinkPage({
  params,
}: {
  params: Promise<{locale: string}>
}) {
  const {locale} = await params
  setRequestLocale(locale)

  return <InvalidMagicLink />
}
