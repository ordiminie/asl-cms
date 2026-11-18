import 'server-only'

import {cache} from 'react'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {ValidationParsedZodError} from '@/services/errors/validation-error'
import {
  canManageRecipientGroupsService,
  getRecipientGroupService,
  listRecipientGroupsService,
} from '@/services/facades/recipient-group-service-facade'
import {
  RecipientGroupDetailDTO,
  RecipientGroupDTO,
} from '@/services/types/domain/recipient-group-types'

/**
 * Groupes de destinataires (s27, ADR 060). **Aucun `'use cache'`** : donnees
 * du bureau, qui nomment des fiches, streamees derriere un `<Suspense>`.
 * `cache()` deduplique dans la requete. Le service ouvre le scope du tenant
 * passe, celui du domaine appele.
 */
export const getRecipientGroupsForBureauDal = cache(
  async (organizationId: string): Promise<RecipientGroupDTO[]> =>
    listRecipientGroupsService(organizationId)
)

/**
 * Un groupe ouvert. L'absence, ou un identifiant malforme, devient
 * `undefined`, que la page traduit en 404 ; un refus ou une panne remonte. Un
 * groupe d'une autre association est absent : la RLS ne le rend pas.
 */
export const getRecipientGroupForBureauDal = cache(
  async (
    organizationId: string,
    groupId: string
  ): Promise<RecipientGroupDetailDTO | undefined> =>
    getRecipientGroupService({organizationId, groupId}).catch(
      (error: unknown) => {
        if (error instanceof ValidationParsedZodError) return undefined
        throw error
      }
    )
)

/**
 * L'utilisateur connecte compose-t-il les groupes de l'association du domaine
 * appele ? Donnee par utilisateur : jamais cachee au-dela de la requete.
 */
export const canManageCurrentRecipientGroupsDal = cache(
  async (): Promise<boolean> => {
    const tenant = await requireCurrentTenantDal()
    return canManageRecipientGroupsService(tenant.id)
  }
)
