import {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {getMemberNotesForBureauDal} from '@/app/dal/member-note-dal'
import {
  canManageCurrentMemberProfilesDal,
  getMemberParcelsForBureauDal,
  getMemberProfileForBureauDal,
} from '@/app/dal/member-profile-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {getMemberUnsubscribeForBureauDal} from '@/app/dal/unsubscribe-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {MemberProfileDetail} from '@/components/features/member-profile/member-profile-detail'
import {Skeleton} from '@/components/ui/skeleton'
import {calendarDayOf} from '@/services/types/domain/water-analysis-types'

import {
  attachParcelAction,
  changeMemberRoleAction,
  updateMemberProfileContactAction,
} from '../actions'
import {
  addMemberExchangeAction,
  addMemberNoteAction,
  deleteMemberNoteAction,
  updateMemberNoteAction,
} from '../notes-actions'

type MemberProfilePageProps = {
  params: Promise<{locale: string; id: string}>
  searchParams: Promise<{cree?: string; vente?: string; notes?: string}>
}

/** La page du fil des notes lue dans `?notes=` : un entier, au moins 1. */
const notesPageOf = (value?: string): number => {
  const page = Number(value)
  return Number.isInteger(page) && page >= 1 ? page : 1
}

export async function generateMetadata({
  params,
}: MemberProfilePageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({
    locale,
    namespace: 'BureauMemberProfilesPage',
  })

  return {title: t('detail.metadataTitle')}
}

/**
 * Fiche d'un proprietaire (ecran 3 du design s12). La lecture n'est pas
 * cachee ; le controle d'acces est repete ici. Une fiche d'une autre
 * association n'existe pas pour ce domaine : la page est introuvable.
 */
export default async function BureauMemberProfilePage({
  params,
  searchParams,
}: MemberProfilePageProps) {
  const {locale, id} = await params
  setRequestLocale(locale)
  const {cree, vente, notes} = await searchParams

  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <MemberProfileSection
        memberProfileId={id}
        created={cree === '1'}
        soldParcelId={vente}
        notesPage={notesPageOf(notes)}
      />
    </Suspense>
  )
}

async function MemberProfileSection({
  memberProfileId,
  created,
  soldParcelId,
  notesPage,
}: {
  memberProfileId: string
  created: boolean
  soldParcelId?: string
  notesPage: number
}) {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentMemberProfilesDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const profile = await getMemberProfileForBureauDal(tenant.id, memberProfileId)
  if (!profile) {
    notFound()
  }

  // Le fil des notes (s24) n'est pas attendu : la carte le deroule derriere
  // son propre `<Suspense>`, le reste de la fiche s'affiche sans lui.
  const notesPromise = getMemberNotesForBureauDal(
    tenant.id,
    memberProfileId,
    notesPage
  )
  // Le refus des campagnes (s25), lu a part de la fiche et sans l'attendre.
  const unsubscribePromise = getMemberUnsubscribeForBureauDal(
    tenant.id,
    memberProfileId
  )
  const parcels = await getMemberParcelsForBureauDal(tenant.id, memberProfileId)

  // Lue apres la session, donc au rendu de la requete : la date proposee au
  // rattachement est le jour calendaire de Paris.
  const today = calendarDayOf(new Date())

  return (
    <MemberProfileDetail
      profile={profile}
      parcels={parcels}
      today={today}
      created={created}
      soldParcelId={soldParcelId}
      updateContactAction={updateMemberProfileContactAction}
      attachParcelAction={attachParcelAction}
      changeRoleAction={changeMemberRoleAction}
      notesPromise={notesPromise}
      unsubscribePromise={unsubscribePromise}
      addNoteAction={addMemberNoteAction}
      addExchangeAction={addMemberExchangeAction}
      updateNoteAction={updateMemberNoteAction}
      deleteNoteAction={deleteMemberNoteAction}
    />
  )
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-240 flex-col gap-4 px-4 pt-6 pb-12 sm:px-8">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  )
}
