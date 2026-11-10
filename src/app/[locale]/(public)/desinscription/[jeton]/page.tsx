import {Metadata} from 'next'
import {setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {getAssociationSettingsDal} from '@/app/dal/association-settings-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {getUnsubscribePageStateDal} from '@/app/dal/unsubscribe-dal'
import {AssociationMark} from '@/components/features/association/association-mark'
import {
  UnsubscribePanel,
  type UnsubscribeScreenState,
} from '@/components/features/campaigns/unsubscribe-panel'
import {Skeleton} from '@/components/ui/skeleton'
import {getIdentityVersionFromKey} from '@/services/types/domain/association-identity-types'
import {CONTACT_EMAIL_SETTING_KEY} from '@/services/types/domain/association-settings-types'

import {confirmUnsubscribeAction} from './actions'

/**
 * Le jeton est dans l'URL : la page n'est jamais indexee, et aucun referent
 * ne la cite quand le membre suit un lien sortant.
 */
export const metadata: Metadata = {
  robots: {index: false, follow: false},
  referrer: 'no-referrer',
}

type UnsubscribePageProps = {
  params: Promise<{locale: string; jeton: string}>
}

/**
 * Desinscription des campagnes (ecran 6 du design s25, ADR 051). Le rendu
 * **lit seulement** l'etat du jeton dans l'association du domaine appele ;
 * l'ecriture est le bouton « Me desinscrire ».
 */
export default async function UnsubscribePage({params}: UnsubscribePageProps) {
  const {locale, jeton} = await params
  setRequestLocale(locale)

  return (
    <Suspense
      fallback={<Skeleton className="mx-auto my-16 h-64 w-full max-w-170" />}
    >
      <UnsubscribeSection token={jeton} />
    </Suspense>
  )
}

const contactEmailOf = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null

async function UnsubscribeSection({token}: {token: string}) {
  const tenant = await requireCurrentTenantDal()
  const [state, settings] = await Promise.all([
    getUnsubscribePageStateDal(tenant.id, token)
      .then((read): UnsubscribeScreenState => read.status)
      .catch((): UnsubscribeScreenState => 'error'),
    getAssociationSettingsDal(tenant.id).catch(() => undefined),
  ])

  return (
    <div className="mx-auto flex w-full max-w-170 flex-col gap-8 px-4 pt-8 pb-12 sm:px-6 sm:py-16">
      <AssociationMark
        name={tenant.name}
        logoVersion={getIdentityVersionFromKey(tenant.logoKey)}
        size="public"
      />
      <UnsubscribePanel
        token={token}
        associationName={tenant.name}
        contactEmail={contactEmailOf(
          settings?.[CONTACT_EMAIL_SETTING_KEY]?.value
        )}
        initialState={state}
        confirmAction={confirmUnsubscribeAction}
      />
    </div>
  )
}
