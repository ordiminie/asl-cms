import {getAuthUser} from '../authentication/auth-service'
import {isUserAdmin, userCanOnResource} from './authorization-service'
import {ActionsConst, SubjectsConst} from './casl-abilities'

/**
 * Un utilisateur connecté gère son propre programme d'affiliation.
 * Un admin global peut consulter celui de n'importe qui.
 */
export const canManageOwnAffiliate = async (): Promise<boolean> => {
  const authUser = await getAuthUser()
  if (!authUser) return false

  return userCanOnResource(
    authUser,
    ActionsConst.MANAGE,
    SubjectsConst.AFFILIATE,
    {userId: authUser.id}
  )
}

export const canReadAffiliate = async (userId: string): Promise<boolean> => {
  const authUser = await getAuthUser()
  if (!authUser) return false

  if (isUserAdmin(authUser)) return true

  return userCanOnResource(
    authUser,
    ActionsConst.READ,
    SubjectsConst.AFFILIATE,
    {userId}
  )
}

/**
 * Consulter le programme dans son ensemble, valider et payer : réservé à
 * l'administration. Le versement est un mouvement d'argent, il ne doit jamais
 * pouvoir être déclenché par le bénéficiaire.
 */
export const canAdministerAffiliates = async (): Promise<boolean> => {
  const authUser = await getAuthUser()
  if (!authUser) return false

  return isUserAdmin(authUser)
}
