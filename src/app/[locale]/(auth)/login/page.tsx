import {redirect} from 'next/navigation'
import {Metadata} from 'next/types'
import {getTranslations, setRequestLocale} from 'next-intl/server'

import {requestMagicLinkAction} from '@/app/[locale]/(auth)/action'
import {AccessClosedNotice} from '@/components/features/auth/access-closed-notice'
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
 * Apres la fermeture d'un acces (`?acces=ferme`, s12d, ecran D), un encadre
 * neutre le dit au-dessus du formulaire ; rien d'autre ne change.
 */
export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>
  searchParams: Promise<{acces?: string | string[]}>
}) {
  const {locale} = await params
  setRequestLocale(locale)

  const user = await getAuthUser()
  if (user) {
    redirect('/logout')
  }

  const {acces} = await searchParams
  const login = <MagicLinkLogin requestAction={requestMagicLinkAction} />
  if (acces !== 'ferme') return login

  return (
    <div className="flex flex-col gap-4">
      <AccessClosedNotice />
      {login}
    </div>
  )
}
