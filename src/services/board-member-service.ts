import 'server-only'

import {BoardMemberModel} from '@/db/models/board-member-model'
import {
  addBoardMemberDao,
  getBoardMemberByIdDao,
  getBoardMembersByOrganizationDao,
  removeBoardMemberAndRenumberTxnDao,
  reorderBoardMembersTxnDao,
  updateBoardMemberDao,
} from '@/db/repositories/board-member-repository'
import {withTenant} from '@/db/tenant-scope'
import {resizeToSquareWebp} from '@/lib/files/resize-image'
import {logger} from '@/lib/logger'

import {getAuthUser} from './authentication/auth-service'
import {canPerformAction} from './authorization/action-registry-authorization'
import {canManageAssociation} from './authorization/association-authorization'
import {getContentFileStorage} from './content-file-service'
import {AuthorizationError} from './errors/authorization-error'
import {NotFoundError} from './errors/not-found-error'
import {
  ValidationError,
  ValidationParsedZodError,
} from './errors/validation-error'
import {ActionIdConst} from './types/domain/action-registry-types'
import {
  BOARD_MEMBER_PHOTO_SLOT,
  BoardMemberDTO,
  BoardMemberMutationResult,
  PORTRAIT_STORED_SIZE,
} from './types/domain/board-member-types'
import {
  buildContentFileKey,
  CONTENT_FILE_CONTENT_TYPES,
  ContentFileScopeConst,
  validateContentFile,
} from './types/domain/content-file-types'
import {
  boardMemberOrganizationIdSchema,
  boardMemberReferenceServiceSchema,
  createBoardMemberServiceSchema,
  reorderBoardMembersServiceSchema,
  updateBoardMemberServiceSchema,
} from './validation/board-member-validation'

const MANAGE_DENIED =
  "Seul le bureau de l'association peut gérer les fiches du bureau"
const MEMBER_NOT_FOUND = 'Fiche du bureau introuvable'
const UNKNOWN_MEMBER_IN_ORDER =
  "Cet ordre contient une fiche qui n'appartient pas à cette association"

/** Le format stocke apres redimensionnement (ADR 024) : toujours WebP. */
const STORED_FORMAT = 'webp'

type PhotoInput = {photo?: File | null; removePhoto?: boolean}

const toBoardMemberDto = (row: BoardMemberModel): BoardMemberDTO => ({
  id: row.id,
  organizationId: row.organizationId,
  name: row.name,
  roleLabel: row.roleLabel,
  photoKey: row.photoKey,
  biography: row.biography,
  rank: row.rank,
})

const requireBoardMemberManager = async (
  organizationId: string
): Promise<void> => {
  const authUser = await getAuthUser()
  if (
    !canPerformAction(
      authUser,
      organizationId,
      ActionIdConst.BOARD_MEMBER_MANAGE
    )
  ) {
    throw new AuthorizationError(MANAGE_DENIED)
  }
}

const listMembers = async (
  organizationId: string
): Promise<BoardMemberModel[]> =>
  withTenant(organizationId, () =>
    getBoardMembersByOrganizationDao(organizationId)
  )

const requireBoardMember = async (
  organizationId: string,
  memberId: string
): Promise<BoardMemberModel> => {
  const row = await withTenant(organizationId, () =>
    getBoardMemberByIdDao(memberId)
  )
  if (!row) {
    throw new NotFoundError(MEMBER_NOT_FOUND)
  }
  return row
}

/**
 * Un echec d'effacement laisse un fichier orphelin, jamais une operation en
 * echec : la fiche est deja a jour en base, et refuser l'enregistrement pour
 * un octet resté sur le disque serait pire. Seul precedent :
 * `association-identity-service.ts`.
 */
const deletePreviousPhoto = async (previousKey: string | null) => {
  if (!previousKey) return
  try {
    await getContentFileStorage().delete(previousKey)
  } catch (error) {
    logger.warn('[BOARD-MEMBER] Ancienne photo laissee orpheline', {
      key: previousKey,
      error: (error as Error).message,
    })
  }
}

/**
 * Valide la photo par **signature binaire**, et seulement ensuite la decode :
 * un fichier refuse n'est jamais passe au redimensionneur.
 */
const checkPhoto = async (
  photo: File
): Promise<
  | {accepted: true; content: Uint8Array}
  | Extract<BoardMemberMutationResult, {status: 'rejected'}>
> => {
  const content = new Uint8Array(await photo.arrayBuffer())
  const validation = validateContentFile('image', content)
  if (validation.valid) return {accepted: true, content}

  return validation.reason === 'size'
    ? {
        status: 'rejected',
        reason: 'size',
        size: validation.size,
        maxBytes: validation.maxBytes,
      }
    : {status: 'rejected', reason: 'format'}
}

/** Redimensionne (ADR 024) puis ecrit sous une cle generee par le serveur. */
const storePhoto = async (
  organizationId: string,
  memberId: string,
  content: Uint8Array
): Promise<string> => {
  const resized = await resizeToSquareWebp(content, PORTRAIT_STORED_SIZE)
  const key = buildContentFileKey(
    organizationId,
    ContentFileScopeConst.BOARD,
    memberId,
    BOARD_MEMBER_PHOTO_SLOT,
    STORED_FORMAT
  )

  await getContentFileStorage().upload(
    new File([resized as BlobPart], `${BOARD_MEMBER_PHOTO_SLOT}.webp`, {
      type: CONTENT_FILE_CONTENT_TYPES[STORED_FORMAT],
    }),
    key
  )

  return key
}

/**
 * Cree une fiche. Elle est publique des son enregistrement : il n'y a ni
 * statut ni brouillon, donc nom et role sont obligatoires.
 *
 * Ordre : `safeParse` -> controle d'acces -> validation de la photo -> ecriture
 * de la ligne -> redimensionnement -> ecriture du fichier -> reference. La
 * ligne precede le fichier parce que la cle porte l'identifiant de la fiche,
 * qui n'existe pas avant l'insertion. Une photo refusee est rendue comme un
 * resultat : **rien** n'est ecrit, pas meme la ligne.
 */
export const createBoardMemberService = async (
  input: {
    organizationId: string
    name: string
    roleLabel: string
    biography: string
  } & PhotoInput
): Promise<BoardMemberMutationResult> => {
  const parsed = createBoardMemberServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const {organizationId, name, roleLabel, biography} = parsed.data
  await requireBoardMemberManager(organizationId)

  const photo = input.photo ? await checkPhoto(input.photo) : undefined
  if (photo && !('accepted' in photo)) return photo

  const existing = await listMembers(organizationId)
  const created = await withTenant(organizationId, () =>
    addBoardMemberDao({
      organizationId,
      name,
      roleLabel,
      biography,
      photoKey: null,
      rank: existing.length,
    })
  )

  if (!photo) return {status: 'saved', member: toBoardMemberDto(created)}

  const photoKey = await storePhoto(organizationId, created.id, photo.content)
  const saved = await withTenant(organizationId, () =>
    updateBoardMemberDao(created.id, {
      name,
      roleLabel,
      biography,
      photoKey,
    })
  )

  return {status: 'saved', member: toBoardMemberDto(saved)}
}

/**
 * Enregistre une fiche. Sans photo deposee ni retrait demande, la photo en
 * place est conservee : un enregistrement de texte ne doit pas effacer un
 * portrait.
 *
 * L'ancien fichier est efface **apres** l'ecriture en base : dans l'autre
 * ordre, un echec d'ecriture laisserait une fiche qui reference un fichier
 * disparu.
 */
export const updateBoardMemberService = async (
  input: {
    organizationId: string
    memberId: string
    name: string
    roleLabel: string
    biography: string
  } & PhotoInput
): Promise<BoardMemberMutationResult> => {
  const parsed = updateBoardMemberServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const {organizationId, memberId, name, roleLabel, biography} = parsed.data
  await requireBoardMemberManager(organizationId)

  const photo = input.photo ? await checkPhoto(input.photo) : undefined
  if (photo && !('accepted' in photo)) return photo

  const current = await requireBoardMember(organizationId, memberId)

  let photoKey = current.photoKey
  let previousKey: string | null = null

  if (photo) {
    photoKey = await storePhoto(organizationId, memberId, photo.content)
    previousKey = current.photoKey
  } else if (input.removePhoto) {
    photoKey = null
    previousKey = current.photoKey
  }

  const saved = await withTenant(organizationId, () =>
    updateBoardMemberDao(memberId, {name, roleLabel, biography, photoKey})
  )

  await deletePreviousPhoto(previousKey)

  return {status: 'saved', member: toBoardMemberDto(saved)}
}

/**
 * Supprime une fiche, renumerote les restantes dans la **meme** transaction
 * (critere 3), puis efface la photo. Irreversible : la photo part avec la
 * fiche, et c'est ce que le dialogue annonce.
 */
export const removeBoardMemberService = async (input: {
  organizationId: string
  memberId: string
}): Promise<void> => {
  const parsed = boardMemberReferenceServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const {organizationId, memberId} = parsed.data
  await requireBoardMemberManager(organizationId)

  const removed = await withTenant(organizationId, () =>
    removeBoardMemberAndRenumberTxnDao(organizationId, memberId)
  )
  if (!removed) {
    throw new NotFoundError(MEMBER_NOT_FOUND)
  }

  await deletePreviousPhoto(removed.photoKey)
}

/**
 * Ecrit l'ordre recu. Un identifiant etranger a l'association est refuse
 * **avant** toute ecriture : sous RLS il ne changerait rien, mais il
 * signalerait un ordre construit sur une autre liste que celle affichee.
 */
export const reorderBoardMembersService = async (input: {
  organizationId: string
  orderedIds: string[]
}): Promise<void> => {
  const parsed = reorderBoardMembersServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const {organizationId, orderedIds} = parsed.data
  await requireBoardMemberManager(organizationId)

  const known = new Set(
    (await listMembers(organizationId)).map((row) => row.id)
  )
  if (orderedIds.some((id) => !known.has(id))) {
    throw new ValidationError(UNKNOWN_MEMBER_IN_ORDER)
  }

  await withTenant(organizationId, () =>
    reorderBoardMembersTxnDao(organizationId, orderedIds)
  )
}

/**
 * Liste publique des fiches, dans l'ordre des rangs.
 *
 * **Sans controle d'autorisation, et c'est delibere** : une fiche du bureau
 * s'adresse aux visiteurs — il n'existe ni statut ni brouillon.
 */
export const getBoardMembersService = async (
  organizationId: string
): Promise<BoardMemberDTO[]> => {
  const parsed = boardMemberOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const rows = await listMembers(parsed.data)
  return rows.map((row) => toBoardMemberDto(row))
}

/** La meme liste, pour l'ecran de gestion : reservee au bureau. */
export const getBoardMembersForBureauService = async (
  organizationId: string
): Promise<BoardMemberDTO[]> => {
  const parsed = boardMemberOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requireBoardMemberManager(parsed.data)

  const rows = await listMembers(parsed.data)
  return rows.map((row) => toBoardMemberDto(row))
}

/**
 * L'utilisateur connecte peut-il gerer les fiches du bureau ? Sert
 * l'interface (menu, garde d'ecran) ; chaque mutation reverifie.
 */
export const canManageBoardMembersService = async (
  organizationId: string
): Promise<boolean> => {
  const parsed = boardMemberOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) return false

  const authUser = await getAuthUser()
  return canManageAssociation(authUser, parsed.data)
}
