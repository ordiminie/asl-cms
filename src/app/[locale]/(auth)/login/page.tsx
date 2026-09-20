import {redirect} from 'next/navigation'
import {Metadata} from 'next/types'
import {getTranslations, setRequestLocale} from 'next-intl/server'

import {requestMagicLinkAction} from '@/app/[locale]/(auth)/action'
import {MagicLinkLogin} from '@/components/features/auth/magic-link-login'
import {getAuthUser} from '@/services/authentication/auth-service'

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>
}): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'Auth.LoginPage'})

  return {
    title: t('metadata.title'),
    description: t('metadata.description'),
  }
}

/**
 * Connexion d'un membre (s03, ecrans A et B) : un lien recu par email, aucun
 * mot de passe. Le formulaire par mot de passe vit a `/login/prestataire`.
 */
export default async function LoginPage({
  params,
}: {
  params: Promise<{locale: string}>
}) {
  const {locale} = await params
  setRequestLocale(locale)

  const user = await getAuthUser()
  if (user) {
    redirect('/logout')
  }

  return <MagicLinkLogin requestAction={requestMagicLinkAction} />
}
