import 'server-only'

import {getMemberProfilesByUserIdDao} from '@/db/repositories/member-profile-repository'

import {pendingRowsStillAuthored} from './rules/member-email-rules'

type PendingRowOfAuthor = {
  memberProfileId: string
  addedByUserId: string | null
}

/**
 * Les attentes d'un lien encore activables (revues s54 C1, mi1, mi3, mi4 ;
 * ADR 056 §5) : l'auteur de chacune, lu attente par attente, doit etre encore
 * relie a sa fiche ; une attente sans auteur ne l'est jamais. Rend aussi les
 * fiches reliees a l'un des auteurs, pour la revérification du critere 7.
 * Sous le scope du tenant de l'appelant.
 */
export const stillAuthoredPendingRows = async <Row extends PendingRowOfAuthor>(
  organizationId: string,
  rows: readonly Row[]
): Promise<{rows: Row[]; authorProfileIds: Set<string>}> => {
  const authors = [
    ...new Set(
      rows.flatMap((row) => (row.addedByUserId ? [row.addedByUserId] : []))
    ),
  ]
  const byAuthor = new Map<string, Set<string>>()
  for (const authorUserId of authors) {
    const profiles = await getMemberProfilesByUserIdDao(
      organizationId,
      authorUserId
    )
    byAuthor.set(authorUserId, new Set(profiles.map((profile) => profile.id)))
  }
  return {
    rows: pendingRowsStillAuthored(rows, byAuthor),
    authorProfileIds: new Set(
      [...byAuthor.values()].flatMap((profileIds) => [...profileIds])
    ),
  }
}
