import {Metadata} from 'next'
import {setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {getMemberEmailConfirmationStateDal} from '@/app/dal/member-email-confirmation-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {AssociationMark} from '@/components/features/association/association-mark'
import {MemberEmailConfirmationPanel} from '@/components/features/member-email/member-email-confirmation-panel'
import {Skeleton} from '@/components/ui/skeleton'
import {getIdentityVersionFromKey} from '@/services/types/domain/association-identity-types'
import type {MemberEmailConfirmationStateDTO} from '@/services/types/domain/member-email-types'

import {confirmMemberEmailAction} from './actions'

/**
 * Le jeton est dans l'URL : la page n'est jamais indexee, et aucun referent
 * ne la cite quand la personne suit un lien sortant.
 */
export const metadata: Metadata = {
  robots: {index: false, follow: false},
  referrer: 'no-referrer',
}

type MemberEmailConfirmationPageProps = {
  params: Promise<{locale: string; jeton: string}>
}

/**
 * « Confirmer votre adresse » (s54, ecran 3, ADR 056 §5). Le rendu **lit
 * seulement** l'etat du jeton dans l'association du domaine appele ;
 * l'ecriture est le bouton « Confirmer cette adresse ».
 */
export default async function MemberEmailConfirmationPage({
  params,
}: MemberEmailConfirmationPageProps) {
  const {locale, jeton} = await params
  setRequestLocale(locale)

  return (
    <Suspense
      fallback={<Skeleton className="mx-auto my-16 h-64 w-full max-w-170" />}
    >
      <ConfirmationSection token={jeton} />
    </Suspense>
  )
}

async function ConfirmationSection({token}: {token: string}) {
  const tenant = await requireCurrentTenantDal()
  const state = await getMemberEmailConfirmationStateDal(
    tenant.id,
    token
  ).catch((): MemberEmailConfirmationStateDTO => ({status: 'invalid'}))

  return (
    <div className="mx-auto flex w-full max-w-170 flex-col gap-8 px-4 pt-8 pb-12 sm:px-6 sm:py-16">
      <AssociationMark
        name={tenant.name}
        logoVersion={getIdentityVersionFromKey(tenant.logoKey)}
        size="public"
      />
      <MemberEmailConfirmationPanel
        token={token}
        associationName={tenant.name}
        initialState={state}
        confirmAction={confirmMemberEmailAction}
      />
    </div>
  )
}
