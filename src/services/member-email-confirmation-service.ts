import 'server-only'

import {z} from 'zod'

import {
  getActiveEmailCarriersDao,
  getMemberProfileEmailsByTokenHashDao,
  purgeExpiredPendingEmailsDao,
} from '@/db/repositories/member-profile-email-repository'
import {
  getCurrentParcelNumbersByProfileDao,
  getMemberProfileByIdDao,
} from '@/db/repositories/member-profile-repository'
import {getUserByIdDao} from '@/db/repositories/user-repository'
import {withTenant} from '@/db/tenant-scope'

import {ValidationParsedZodError} from './errors/validation-error'
import {stillAuthoredPendingRows} from './member-email-pending-authors'
import {
  hashConfirmationToken,
  isConfirmationTokenShaped,
} from './member-email-token'
import {activatePendingEmail} from './member-profile-support'
import {decideConfirmation} from './rules/member-email-rules'
import {MemberAccountAuthor} from './types/domain/member-account-types'
import {
  ConfirmMemberEmailResult,
  MemberEmailConfirmationRequest,
  MemberEmailConfirmationStateDTO,
} from './types/domain/member-email-types'

/**
 * Confirmation par lien d'une adresse ajoutee ou modifiee par un membre (s54,
 * ADR 056 §5).
 *
 * **Sans controle d'autorisation, et c'est delibere** : le jeton aleatoire de
 * 256 bits est le seul titre, comme la desinscription (s25). L'association
 * vient du **domaine appele**, passee par l'appelant : un jeton d'une autre
 * association ne se resout pas sous la RLS. Le jeton n'est lu qu'en hash
 * SHA-256, jamais ecrit ni journalise en clair. La lecture (page) n'ecrit
 * jamais ; seule la confirmation (bouton) ecrit — jamais au chargement : les
 * anti-virus de messagerie ouvrent les liens.
 */

const requestSchema = z.object({
  organizationId: z.string().uuid(),
  token: z.string(),
})

const parseRequest = (input: MemberEmailConfirmationRequest) => {
  const parsed = requestSchema.safeParse(input)
  if (!parsed.success) throw new ValidationParsedZodError(parsed.error)
  return parsed.data
}

/** Les adresses en attente du jeton, si sa forme est celle d'un jeton. */
const pendingRowsOf = async (token: string) =>
  isConfirmationTokenShaped(token)
    ? getMemberProfileEmailsByTokenHashDao(hashConfirmationToken(token))
    : []

/**
 * L'adresse est-elle active sur une fiche de l'association que ni l'auteur ni
 * le lien ne concernent ? Revérifie a la confirmation (critere 7, course).
 */
const isTakenElsewhere = async (
  organizationId: string,
  email: string,
  authorProfileIds: ReadonlySet<string>,
  pendingProfileIds: string[]
): Promise<boolean> => {
  const own = new Set([...authorProfileIds, ...pendingProfileIds])
  const carriers = await getActiveEmailCarriersDao(organizationId, email)
  return carriers.some((carrier) => !own.has(carrier.memberProfileId))
}

type PendingRows = Awaited<ReturnType<typeof pendingRowsOf>>

type ActivablePending = {
  /** La premiere attente du jeton, absente pour un jeton inconnu. */
  first: PendingRows[number]
  rows: PendingRows
  /** Les fiches encore reliees a l'un des auteurs du lien. */
  authorProfileIds: Set<string>
}

/**
 * Les attentes du jeton, reduites a celles encore activables : l'auteur de
 * chacune doit etre encore relie a sa fiche (revue C1, ADR 056 §5).
 */
const activablePendingOf = async (
  organizationId: string,
  token: string
): Promise<ActivablePending> => {
  const all = await pendingRowsOf(token)
  const [first] = all
  return {first, ...(await stillAuthoredPendingRows(organizationId, all))}
}

/** L'etat de la page publique ; **lecture seule**. */
export const getMemberEmailConfirmationStateService = async (
  input: MemberEmailConfirmationRequest
): Promise<MemberEmailConfirmationStateDTO> => {
  const {organizationId, token} = parseRequest(input)
  const now = new Date()

  return withTenant(organizationId, async () => {
    const {first, rows} = await activablePendingOf(organizationId, token)
    const decision = decideConfirmation({
      record: first,
      takenElsewhere: false,
      revoked: rows.length === 0,
      now,
    })
    if (decision !== 'ok') return {status: 'invalid'}
    const numbers = await getCurrentParcelNumbersByProfileDao(
      rows.map((row) => row.memberProfileId)
    )
    return {
      status: 'confirm',
      email: first.email,
      parcelNumbers: [...new Set(Object.values(numbers).flat())].sort((a, b) =>
        a.localeCompare(b, 'fr', {numeric: true})
      ),
    }
  })
}

/** L'auteur de l'ajout, copie dans la trace d'un role deplace (ADR 039). */
const authorOfPending = async (
  userId: string | null
): Promise<MemberAccountAuthor> => {
  if (!userId) return {userId: null, name: null}
  const user = await getUserByIdDao(userId)
  return {userId, name: user?.name ?? null}
}

/**
 * « Confirmer cette adresse » : un jeton inconnu, echu, annule ou deja
 * utilise rend le meme etat (3c) ; une adresse prise entre-temps n'est pas
 * activee (3d) ; une attente dont l'auteur n'est plus relie a la fiche est
 * ignoree, et le lien rend 3c s'il n'en reste aucune (revues C1, MA1).
 * Sinon chaque attente du lien s'active (ajout, ou
 * modification qui remplace l'ancienne adresse), son compte s'ouvre, et le
 * jeton est efface : usage unique. Les attentes echues sont purgees.
 */
export const confirmMemberEmailService = async (
  input: MemberEmailConfirmationRequest
): Promise<ConfirmMemberEmailResult> => {
  const {organizationId, token} = parseRequest(input)
  const now = new Date()

  return withTenant(organizationId, async () => {
    const {first, rows, authorProfileIds} = await activablePendingOf(
      organizationId,
      token
    )
    const taken =
      first !== undefined &&
      rows.length > 0 &&
      (await isTakenElsewhere(
        organizationId,
        first.email,
        authorProfileIds,
        rows.map((row) => row.memberProfileId)
      ))
    const decision = decideConfirmation({
      record: first,
      takenElsewhere: taken,
      revoked: rows.length === 0,
      now,
    })
    await purgeExpiredPendingEmailsDao(organizationId, now)
    if (decision !== 'ok') return {status: decision}

    for (const row of rows) {
      const profile = await getMemberProfileByIdDao(row.memberProfileId)
      if (!profile) continue
      await activatePendingEmail({
        organizationId,
        profile,
        pendingId: row.id,
        email: row.email,
        author: await authorOfPending(row.addedByUserId),
        now,
      })
    }
    return {
      status: 'confirmed',
      replaced: rows.some((row) => row.replacesEmailId !== null),
    }
  })
}
