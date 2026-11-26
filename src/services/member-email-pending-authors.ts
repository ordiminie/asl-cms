import 'server-only'

import {getUserOrganizationDao} from '@/db/repositories/organization-repository'

import {getMyAccessibleProfiles} from './member-profile-access-service'
import {pendingRowsStillAuthored} from './rules/member-email-rules'

type PendingRowOfAuthor = {
  memberProfileId: string
  addedByUserId: string | null
}

/**
 * Les fiches auxquelles un auteur est encore relie, aucune s'il n'a plus de
 * ligne `member` dans l'association (revue s54 round 4, MA-r4) : un lien
 * fiche ↔ compte survit au retrait de la ligne par le SuperAdmin. Une fiche
 * fermee apres la vente n'en fait plus partie (s57, ADR 075 §4).
 */
const profileIdsOfMemberAuthor = async (
  organizationId: string,
  authorUserId: string
): Promise<Set<string>> => {
  if (!(await getUserOrganizationDao(authorUserId, organizationId))) {
    return new Set()
  }
  const profiles = await getMyAccessibleProfiles(organizationId, authorUserId)
  return new Set(profiles.map((profile) => profile.id))
}

/**
 * Les attentes d'un lien encore activables (revues s54 C1, mi1, mi4, MA-r4 ;
 * ADR 056 §5) : l'auteur de chacune, lu attente par attente, doit etre encore
 * membre de l'association et relie a sa fiche ; une attente sans auteur ne
 * l'est jamais. Rend aussi les fiches reliees a l'un des auteurs membres, pour
 * la revérification du critere 7. Sous le scope du tenant de l'appelant.
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
    byAuthor.set(
      authorUserId,
      await profileIdsOfMemberAuthor(organizationId, authorUserId)
    )
  }
  return {
    rows: pendingRowsStillAuthored(rows, byAuthor),
    authorProfileIds: new Set(
      [...byAuthor.values()].flatMap((profileIds) => [...profileIds])
    ),
  }
}
