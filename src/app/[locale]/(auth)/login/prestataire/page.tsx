import {redirect} from 'next/navigation'
import {Metadata} from 'next/types'
import {getTranslations, setRequestLocale} from 'next-intl/server'

import {LoginForm} from '@/components/features/auth/forms/login'
import {getAuthUser} from '@/services/authentication/auth-service'

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>
}): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'Auth.ProviderLoginPage'})

  return {
    title: t('metadata.title'),
    description: t('metadata.description'),
  }
}

/**
 * Acces prestataire (s03) : la connexion par mot de passe, conservee au moins
 * pour le SuperAdmin. Ni inscription ni lien magique ici : les membres se
 * connectent par `/login`.
 */
export default async function ProviderLoginPage({
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

  return <LoginForm />
}
