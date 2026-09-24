import {and, asc, eq, gt} from 'drizzle-orm'

import {boardMember, BoardMemberModel} from '@/db/models/board-member-model'
import {getDb} from '@/db/tenant-scope'

/**
 * Fiches du bureau d'une association (s06). Sous RLS forcee : hors
 * `withTenant(organizationId, ...)`, rien ne sort et rien ne s'ecrit.
 */

export const getBoardMembersByOrganizationDao = async (
  organizationId: string
): Promise<BoardMemberModel[]> =>
  getDb()
    .select()
    .from(boardMember)
    .where(eq(boardMember.organizationId, organizationId))
    .orderBy(asc(boardMember.rank))

export const getBoardMemberByIdDao = async (
  memberId: string
): Promise<BoardMemberModel | undefined> => {
  const [row] = await getDb()
    .select()
    .from(boardMember)
    .where(eq(boardMember.id, memberId))
  return row
}

export const addBoardMemberDao = async (input: {
  organizationId: string
  name: string
  roleLabel: string
  biography: string
  photoKey: string | null
  rank: number
}): Promise<BoardMemberModel> => {
  const [row] = await getDb().insert(boardMember).values(input).returning()
  return row
}

export const updateBoardMemberDao = async (
  memberId: string,
  input: {
    name: string
    roleLabel: string
    biography: string
    photoKey: string | null
  }
): Promise<BoardMemberModel> => {
  const [row] = await getDb()
    .update(boardMember)
    .set({...input, updatedAt: new Date()})
    .where(eq(boardMember.id, memberId))
    .returning()
  return row
}

/**
 * Ecrit l'ordre des fiches en **une** transaction : le rang de chaque fiche
 * vient de sa position dans le tableau recu. Une seule fonction pour les deux
 * chemins de reordonnancement — la souris et le clavier lui passent le meme
 * tableau, donc produisent le meme resultat.
 */
export const reorderBoardMembersTxnDao = async (
  organizationId: string,
  orderedIds: string[]
): Promise<void> => {
  if (orderedIds.length === 0) return

  await getDb().transaction(async (tx) => {
    for (const [index, memberId] of orderedIds.entries()) {
      await tx
        .update(boardMember)
        .set({rank: index, updatedAt: new Date()})
        .where(
          and(
            eq(boardMember.id, memberId),
            eq(boardMember.organizationId, organizationId)
          )
        )
    }
  })
}

/**
 * Supprime une fiche **et** renumerote les suivantes, dans **une seule**
 * transaction (critere 3 : « sans trou »). `removeMenuItemDao` de s04b se
 * contentait de supprimer et laissait des rangs troues ; ici la contiguite est
 * une garantie, prouvee en e2e sur les rangs en base.
 *
 * Rend la cle de photo de la fiche supprimee pour que le service efface le
 * fichier **apres** la transaction : une suppression de fichier ne se defait
 * pas par un `ROLLBACK`.
 */
export const removeBoardMemberAndRenumberTxnDao = async (
  organizationId: string,
  memberId: string
): Promise<{photoKey: string | null} | undefined> =>
  getDb().transaction(async (tx) => {
    const [removed] = await tx
      .delete(boardMember)
      .where(
        and(
          eq(boardMember.id, memberId),
          eq(boardMember.organizationId, organizationId)
        )
      )
      .returning({photoKey: boardMember.photoKey, rank: boardMember.rank})

    if (!removed) return undefined

    const following = await tx
      .select({id: boardMember.id})
      .from(boardMember)
      .where(
        and(
          eq(boardMember.organizationId, organizationId),
          gt(boardMember.rank, removed.rank)
        )
      )
      .orderBy(asc(boardMember.rank))

    for (const [index, row] of following.entries()) {
      await tx
        .update(boardMember)
        .set({rank: removed.rank + index, updatedAt: new Date()})
        .where(eq(boardMember.id, row.id))
    }

    return {photoKey: removed.photoKey}
  })
