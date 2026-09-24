import 'server-only'

import {cacheLife, cacheTag} from 'next/cache'
import {cache} from 'react'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {
  canManageBoardMembersService,
  getBoardMembersForBureauService,
  getBoardMembersService,
} from '@/services/facades/board-member-service-facade'
import {BoardMemberDTO} from '@/services/types/domain/board-member-types'
import {contentFileUrl} from '@/services/types/domain/content-file-types'

/**
 * Tag d'invalidation des fiches du bureau d'une association. **Un seul** : la
 * liste n'est ni paginee ni filtree, et toute ecriture la change en entier —
 * un ajout, une modification, un deplacement, une suppression.
 *
 * Les tags sont stockes en clair : rien d'autre que l'identifiant de
 * l'association.
 */
export const boardMembersTag = (organizationId: string): string =>
  `board-members:${organizationId}`

/**
 * Lecture cachee de la liste publique. Fonction **interne** : elle prend
 * l'identifiant de l'association en argument, et seuls les appelants ci-dessous
 * le fournissent — celui du domaine appele.
 *
 * Aucun appel direct a `logger`, aucune horloge, aucune lecture de requete dans
 * ce scope. Le compromis herite sur l'intercepteur de journalisation des
 * facades est celui decrit dans `page-dal.ts`.
 */
const readBoardMembersCached = cache(
  async (organizationId: string): Promise<BoardMemberDTO[]> => {
    'use cache'
    cacheLife('hours')
    cacheTag(boardMembersTag(organizationId))

    return getBoardMembersService(organizationId)
  }
)

/** Les fiches servies au visiteur, dans l'ordre defini par le bureau. */
export const getPublicBoardMembersDal = async (
  organizationId: string
): Promise<BoardMemberDTO[]> => readBoardMembersCached(organizationId)

/**
 * Liste de gestion du bureau. Non cachee : c'est un ecran d'administration,
 * qui doit refleter la derniere modification sans attendre une invalidation.
 */
export const getBoardMembersForBureauDal = cache(
  async (organizationId: string): Promise<BoardMemberDTO[]> =>
    getBoardMembersForBureauService(organizationId)
)

/**
 * L'utilisateur connecte peut-il gerer les fiches du bureau de l'association
 * du domaine appele ? Donnee par utilisateur : jamais cachee au-dela de la
 * requete.
 */
export const canManageCurrentBoardMembersDal = cache(
  async (): Promise<boolean> => {
    const tenant = await requireCurrentTenantDal()
    return canManageBoardMembersService(tenant.id)
  }
)

/** Adresse publique de la photo d'une fiche. */
export const boardMemberPhotoUrl = (key: string): string => contentFileUrl(key)
