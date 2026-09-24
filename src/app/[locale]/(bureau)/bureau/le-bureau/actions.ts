'use server'

import {updateTag} from 'next/cache'
import {getTranslations} from 'next-intl/server'

import {boardMembersTag} from '@/app/dal/board-member-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import type {BoardMemberSaveState} from '@/components/features/board/board-member-form'
import type {BoardMemberActionResult} from '@/components/features/board/board-member-list'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {
  createBoardMemberService,
  removeBoardMemberService,
  reorderBoardMembersService,
  updateBoardMemberService,
} from '@/services/facades/board-member-service-facade'

/**
 * Server Actions de l'ecran « Membres du bureau » (s06, ecrans 1 et 2).
 *
 * Chacune rejoue le controle de session (`requireActionAuth`) avant d'appeler
 * la facade — le service reverifie l'autorisation de son cote — puis invalide
 * `boardMembersTag` **apres** le succes seulement : un echec ne doit pas faire
 * tomber une lecture publique encore valable. Un refus est rendu comme un
 * resultat traduit, jamais leve : l'ecran l'ecrit dans la page (§5).
 */

const failure = async (
  error: unknown
): Promise<{status: 'error'; message: string}> => {
  const t = await getTranslations('BureauBoardPage.errors')
  return {
    status: 'error',
    message: error instanceof AuthorizationError ? t('forbidden') : t('failed'),
  }
}

const textOf = (formData: FormData, key: string): string => {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

const photoOf = (formData: FormData): File | undefined => {
  const value = formData.get('photo')
  return value instanceof File && value.size > 0 ? value : undefined
}

/** Cree une fiche, photo facultative transmise avec le formulaire. */
export async function createBoardMemberAction(
  formData: FormData
): Promise<BoardMemberSaveState> {
  const tenant = await requireCurrentTenantDal()

  try {
    await requireActionAuth()

    const result = await createBoardMemberService({
      organizationId: tenant.id,
      name: textOf(formData, 'name'),
      roleLabel: textOf(formData, 'roleLabel'),
      biography: textOf(formData, 'biography'),
      photo: photoOf(formData),
    })

    if (result.status === 'rejected') return result

    updateTag(boardMembersTag(tenant.id))
    return {status: 'saved'}
  } catch (error) {
    return failure(error)
  }
}

/**
 * Enregistre une fiche existante. Sans photo deposee ni retrait demande, la
 * photo en place est conservee.
 */
export async function updateBoardMemberAction(
  formData: FormData
): Promise<BoardMemberSaveState> {
  const tenant = await requireCurrentTenantDal()

  try {
    await requireActionAuth()

    const result = await updateBoardMemberService({
      organizationId: tenant.id,
      memberId: textOf(formData, 'memberId'),
      name: textOf(formData, 'name'),
      roleLabel: textOf(formData, 'roleLabel'),
      biography: textOf(formData, 'biography'),
      photo: photoOf(formData),
      removePhoto: textOf(formData, 'removePhoto') === 'true',
    })

    if (result.status === 'rejected') return result

    updateTag(boardMembersTag(tenant.id))
    return {status: 'saved'}
  } catch (error) {
    return failure(error)
  }
}

/**
 * Ecrit l'ordre des fiches. Le rang vient de la position dans la liste recue :
 * souris et clavier empruntent ce seul chemin.
 */
export async function reorderBoardMembersAction(
  orderedIds: string[]
): Promise<BoardMemberActionResult> {
  const tenant = await requireCurrentTenantDal()

  try {
    await requireActionAuth()

    await reorderBoardMembersService({organizationId: tenant.id, orderedIds})

    updateTag(boardMembersTag(tenant.id))
    return {status: 'ok'}
  } catch (error) {
    return failure(error)
  }
}

/** Supprime une fiche, sa photo avec elle. Irreversible. */
export async function removeBoardMemberAction(
  memberId: string
): Promise<BoardMemberActionResult> {
  const tenant = await requireCurrentTenantDal()

  try {
    await requireActionAuth()

    await removeBoardMemberService({organizationId: tenant.id, memberId})

    updateTag(boardMembersTag(tenant.id))
    return {status: 'ok'}
  } catch (error) {
    return failure(error)
  }
}
