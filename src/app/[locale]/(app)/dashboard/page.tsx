import {Suspense} from 'react'

import {
  getMyContactDal,
  getMyIncidentReportsDal,
  getMyLandsDal,
} from '@/app/dal/member-space-dal'
import withAuth, {
  type WithAuthProps,
} from '@/components/features/auth/with-auth'
import {
  MemberSpace,
  MemberSpaceLoading,
  RoleWithdrawnNotice,
} from '@/components/features/member-space/member-space'

import {updateMyContactAction} from './actions'

/** Retour d'une propre retrogradation depuis la fiche (s14, A12). */
const ROLE_WITHDRAWN = 'retire'

/** Retour d'une declaration depuis l'espace (s22, A5). */
const REPORT_SENT = 'envoye'

/** Retour d'une question envoyee depuis l'espace (s23, A2). */
const QUESTION_SENT = 'envoyee'

type DashboardPageProps = WithAuthProps & {
  searchParams: Promise<{
    role?: string
    signalement?: string
    question?: string
  }>
}

/**
 * Espace membre (s46, s12d ecran C) : « Mes terrains » du proprietaire
 * connecte (s53), « Mes coordonnees » (s16), puis la securite du compte. La fiche se lit cote serveur, par la
 * session et le domaine appele, derriere un `<Suspense>` ; un compte sans
 * fiche dans l'association retrouve la page de s46 (C5). Apres sa propre
 * retrogradation, `?role=retire` le dit en tete (s14, A12). « Mes
 * signalements » (s22) se lit a part ; apres une declaration,
 * `?signalement=envoye` le dit dans la carte (A5). Apres une question au
 * bureau (s23), `?question=envoyee` le dit dans sa carte (A2).
 */
async function Page({user, searchParams}: DashboardPageProps) {
  const landsPromise = getMyLandsDal()
  const contactPromise = getMyContactDal()
  const reportsPromise = getMyIncidentReportsDal()
  const {role, signalement, question} = await searchParams

  return (
    <div className="space-y-6">
      {role === ROLE_WITHDRAWN && <RoleWithdrawnNotice />}
      <Suspense fallback={<MemberSpaceLoading name={user.name} />}>
        <MemberSpace
          landsPromise={landsPromise}
          contactPromise={contactPromise}
          contactAction={updateMyContactAction}
          reportsPromise={reportsPromise}
          reportSent={signalement === REPORT_SENT}
          questionSent={question === QUESTION_SENT}
        />
      </Suspense>
    </div>
  )
}

export default withAuth(Page)
