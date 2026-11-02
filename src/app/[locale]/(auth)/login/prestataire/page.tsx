import {redirect} from 'next/navigation'
import {Metadata} from 'next/types'
import {getTranslations, setRequestLocale} from 'next-intl/server'

import {LoginForm} from '@/components/features/auth/forms/login'
import {ImpersonationNotice} from '@/components/features/impersonation/impersonation-notice'
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
  searchParams,
}: {
  params: Promise<{locale: string}>
  searchParams?: Promise<{session?: string}>
}) {
  const {locale} = await params
  setRequestLocale(locale)

  const user = await getAuthUser()
  if (user) {
    redirect('/logout')
  }

  // Fin d'une session a la place d'un compte, par expiration (s48, 4c).
  const sessionEnded = (await searchParams)?.session === 'terminee'

  if (!sessionEnded) return <LoginForm />

  return (
    <div className="flex flex-col gap-4">
      <ImpersonationNotice kind="expired" />
      <LoginForm />
    </div>
  )
}
