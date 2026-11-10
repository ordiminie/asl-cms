import 'server-only'

import {cache} from 'react'

import {listMemberNotesService} from '@/services/facades/member-note-service-facade'
import {MemberNotesPageDTO} from '@/services/types/domain/member-note-types'

/**
 * Le fil des notes internes et des echanges d'une fiche (s24, ADR 050), pour
 * le bureau seulement. **Jamais de `'use cache'`** : donnee personnelle
 * (ADR 038), streamee derriere un `<Suspense>`. `cache()` deduplique dans la
 * requete. Le service ouvre le scope du tenant passe, celui du domaine appele.
 */
export const getMemberNotesForBureauDal = cache(
  async (
    organizationId: string,
    memberProfileId: string,
    page: number
  ): Promise<MemberNotesPageDTO | undefined> =>
    listMemberNotesService({organizationId, memberProfileId, page})
)
