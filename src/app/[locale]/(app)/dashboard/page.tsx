import {Suspense} from 'react'

import {getMyParcelsDal} from '@/app/dal/member-space-dal'
import withAuth, {
  type WithAuthProps,
} from '@/components/features/auth/with-auth'
import {
  MemberSpace,
  MemberSpaceLoading,
} from '@/components/features/member-space/member-space'

/**
 * Espace membre (s46, s12d ecran C) : « Mes parcelles » du proprietaire
 * connecte, puis la securite du compte. La fiche se lit cote serveur, par la
 * session et le domaine appele, derriere un `<Suspense>` ; un compte sans
 * fiche dans l'association retrouve la page de s46 (C5).
 */
async function Page({user}: WithAuthProps) {
  const parcelsPromise = getMyParcelsDal()

  return (
    <Suspense fallback={<MemberSpaceLoading name={user.name} />}>
      <MemberSpace parcelsPromise={parcelsPromise} />
    </Suspense>
  )
}

export default withAuth(Page)
