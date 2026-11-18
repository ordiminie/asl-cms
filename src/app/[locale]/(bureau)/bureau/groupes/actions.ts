'use server'

import {revalidatePath} from 'next/cache'
import {getTranslations} from 'next-intl/server'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {RECIPIENT_GROUPS_ROUTE_PATTERN} from '@/components/features/recipient-groups/recipient-group-paths'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {NotFoundError} from '@/services/errors/not-found-error'
import {DuplicateRecipientGroupNameError} from '@/services/errors/recipient-group-errors'
import {
  createRecipientGroupService,
  deleteRecipientGroupService,
  renameRecipientGroupService,
} from '@/services/facades/recipient-group-service-facade'
import type {
  DeleteRecipientGroupActionResult,
  RecipientGroupDTO,
  RecipientGroupNameActionResult,
} from '@/services/types/domain/recipient-group-types'
import {createRecipientGroupFormSchema} from '@/services/validation/recipient-group-validation'

/**
 * Server Actions des groupes de destinataires (s27, ecran 3). Patron de
 * `campagnes/actions.ts` : tenant du domaine, traductions, controle de
 * session, schema du formulaire, facade — le service reverifie
 * `campaign.group.manage`. Les refus sont rendus en resultats.
 */

type Translator = Awaited<ReturnType<typeof getTranslations>>

const readField = (formData: FormData, key: string): string =>
  formData.get(key)?.toString() ?? ''

const messageKeyOf = (error: unknown): string => {
  if (error instanceof AuthorizationError) return 'errors.forbidden'
  if (error instanceof NotFoundError) return 'errors.notFound'
  return 'errors.failed'
}

const revalidateGroupScreens = () => {
  revalidatePath(RECIPIENT_GROUPS_ROUTE_PATTERN, 'layout')
}

const saveName = async (
  formData: FormData,
  save: (organizationId: string, name: string) => Promise<RecipientGroupDTO>
): Promise<RecipientGroupNameActionResult> => {
  const tenant = await requireCurrentTenantDal()
  const t: Translator = await getTranslations('RecipientGroupsBureau')

  try {
    await requireActionAuth()

    const validation = createRecipientGroupFormSchema(t).safeParse({
      name: readField(formData, 'name'),
    })
    if (!validation.success) {
      return {status: 'invalid', message: validation.error.issues[0].message}
    }

    const group = await save(tenant.id, validation.data.name)
    revalidateGroupScreens()
    return {status: 'saved', group}
  } catch (error) {
    if (error instanceof DuplicateRecipientGroupNameError) {
      return {status: 'invalid', message: t('errors.duplicateName')}
    }
    return {status: 'error', message: t(messageKeyOf(error))}
  }
}

/** « Créer un groupe » : un groupe vide, nomme. */
export async function createRecipientGroupAction(
  _prevState: RecipientGroupNameActionResult | undefined,
  formData: FormData
): Promise<RecipientGroupNameActionResult> {
  return saveName(formData, (organizationId, name) =>
    createRecipientGroupService({organizationId, name})
  )
}

/** « Renommer le groupe ». */
export async function renameRecipientGroupAction(
  _prevState: RecipientGroupNameActionResult | undefined,
  formData: FormData
): Promise<RecipientGroupNameActionResult> {
  return saveName(formData, (organizationId, name) =>
    renameRecipientGroupService({
      organizationId,
      groupId: readField(formData, 'groupId'),
      name,
    })
  )
}

/**
 * « Supprimer le groupe », apres confirmation : ni les fiches ni les
 * campagnes envoyees ne changent (critere 6).
 */
export async function deleteRecipientGroupAction(
  _prevState: DeleteRecipientGroupActionResult | undefined,
  formData: FormData
): Promise<DeleteRecipientGroupActionResult> {
  const tenant = await requireCurrentTenantDal()
  const t = await getTranslations('RecipientGroupsBureau')

  try {
    await requireActionAuth()

    await deleteRecipientGroupService({
      organizationId: tenant.id,
      groupId: readField(formData, 'groupId'),
    })
    revalidateGroupScreens()
    return {status: 'deleted'}
  } catch (error) {
    return {status: 'error', message: t(messageKeyOf(error))}
  }
}
