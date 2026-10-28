import {Suspense} from 'react'

import {getMyParcelsDal} from '@/app/dal/member-space-dal'
import withAuth, {
  type WithAuthProps,
} from '@/components/features/auth/with-auth'
import {
  MemberSpace,
  MemberSpaceLoading,
  RoleWithdrawnNotice,
} from '@/components/features/member-space/member-space'

/** Retour d'une propre retrogradation depuis la fiche (s14, A12). */
const ROLE_WITHDRAWN = 'retire'

type DashboardPageProps = WithAuthProps & {
  searchParams: Promise<{role?: string}>
}

/**
 * Espace membre (s46, s12d ecran C) : « Mes parcelles » du proprietaire
 * connecte, puis la securite du compte. La fiche se lit cote serveur, par la
 * session et le domaine appele, derriere un `<Suspense>` ; un compte sans
 * fiche dans l'association retrouve la page de s46 (C5). Apres sa propre
 * retrogradation, `?role=retire` le dit en tete (s14, A12).
 */
async function Page({user, searchParams}: DashboardPageProps) {
  const parcelsPromise = getMyParcelsDal()
  const {role} = await searchParams

  return (
    <div className="space-y-6">
      {role === ROLE_WITHDRAWN && <RoleWithdrawnNotice />}
      <Suspense fallback={<MemberSpaceLoading name={user.name} />}>
        <MemberSpace parcelsPromise={parcelsPromise} />
      </Suspense>
    </div>
  )
}

export default withAuth(Page)
