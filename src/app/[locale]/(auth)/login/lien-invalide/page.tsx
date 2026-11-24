import {Metadata} from 'next/types'
import {getTranslations, setRequestLocale} from 'next-intl/server'

import {getCurrentAssociationSettingsDal} from '@/app/dal/association-settings-dal'
import {InvalidMagicLink} from '@/components/features/auth/invalid-magic-link'
import {INVITATION_ERROR_REASON} from '@/lib/better-auth/invitation-link'
import {getInvitationLinkDays} from '@/services/types/domain/association-settings-types'

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
 * menent au meme message. Le lien d'une invitation porte `?motif=invitation`
 * (s42a, ADR 071 §3) : l'explication dit alors la duree de l'invitation, lue
 * dans les reglages de l'association du domaine (defaut du registre sans
 * association).
 */
export default async function InvalidMagicLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>
  searchParams: Promise<{motif?: string | string[]}>
}) {
  const {locale} = await params
  setRequestLocale(locale)

  const {motif} = await searchParams
  if (motif !== INVITATION_ERROR_REASON) return <InvalidMagicLink />

  const settings = await getCurrentAssociationSettingsDal()
  return (
    <InvalidMagicLink invitationDays={getInvitationLinkDays(settings ?? {})} />
  )
}
