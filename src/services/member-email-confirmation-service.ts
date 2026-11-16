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
  getMemberProfilesByUserIdDao,
} from '@/db/repositories/member-profile-repository'
import {getUserByIdDao} from '@/db/repositories/user-repository'
import {withTenant} from '@/db/tenant-scope'

import {ValidationParsedZodError} from './errors/validation-error'
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
  authorUserId: string | null,
  pendingProfileIds: string[]
): Promise<boolean> => {
  const own = new Set(pendingProfileIds)
  if (authorUserId) {
    for (const profile of await getMemberProfilesByUserIdDao(
      organizationId,
      authorUserId
    )) {
      own.add(profile.id)
    }
  }
  const carriers = await getActiveEmailCarriersDao(organizationId, email)
  return carriers.some((carrier) => !own.has(carrier.memberProfileId))
}

/** L'etat de la page publique ; **lecture seule**. */
export const getMemberEmailConfirmationStateService = async (
  input: MemberEmailConfirmationRequest
): Promise<MemberEmailConfirmationStateDTO> => {
  const {organizationId, token} = parseRequest(input)
  const now = new Date()

  return withTenant(organizationId, async () => {
    const rows = await pendingRowsOf(token)
    const [first] = rows
    if (
      decideConfirmation({record: first, takenElsewhere: false, now}) !== 'ok'
    ) {
      return {status: 'invalid'}
    }
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
 * activee (3d). Sinon chaque attente du lien s'active (ajout, ou
 * modification qui remplace l'ancienne adresse), son compte s'ouvre, et le
 * jeton est efface : usage unique. Les attentes echues sont purgees.
 */
export const confirmMemberEmailService = async (
  input: MemberEmailConfirmationRequest
): Promise<ConfirmMemberEmailResult> => {
  const {organizationId, token} = parseRequest(input)
  const now = new Date()

  return withTenant(organizationId, async () => {
    const rows = await pendingRowsOf(token)
    const [first] = rows
    const taken =
      first !== undefined &&
      (await isTakenElsewhere(
        organizationId,
        first.email,
        first.addedByUserId,
        rows.map((row) => row.memberProfileId)
      ))
    const decision = decideConfirmation({
      record: first,
      takenElsewhere: taken,
      now,
    })
    await purgeExpiredPendingEmailsDao(organizationId, now)
    if (decision !== 'ok') return {status: decision}

    const author = await authorOfPending(first.addedByUserId)
    for (const row of rows) {
      const profile = await getMemberProfileByIdDao(row.memberProfileId)
      if (!profile) continue
      await activatePendingEmail({
        organizationId,
        profile,
        pendingId: row.id,
        email: row.email,
        author,
        now,
      })
    }
    return {
      status: 'confirmed',
      replaced: rows.some((row) => row.replacesEmailId !== null),
    }
  })
}
