'use server'

import {revalidatePath} from 'next/cache'
import {redirect} from 'next/navigation'
import {getTranslations} from 'next-intl/server'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {
  type DocumentTemplateFormState,
  variableListOf,
} from '@/components/features/document-templates/document-template-form-validation'
import {
  DELETED_DOCUMENT_TEMPLATE_PATH,
  DOCUMENT_TEMPLATES_ROUTE_PATTERN,
  savedDocumentTemplatePathOf,
} from '@/components/features/document-templates/document-template-paths'
import {
  MEMBER_DOCUMENTS_ROUTE_PATTERN,
  MEMBER_PROFILE_ROUTE_PATTERN,
  MEMBER_SPACE_ROUTE_PATTERN,
} from '@/components/features/member-documents/member-document-paths'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {CampaignTargetUnavailableError} from '@/services/errors/campaign-errors'
import {NotFoundError} from '@/services/errors/not-found-error'
import {
  createDocumentTemplateService,
  deleteDocumentTemplateService,
  depositTemplateDocumentService,
  getDocumentLotReachService,
  updateDocumentTemplateService,
} from '@/services/facades/document-template-service-facade'
import type {
  DocumentLotLineResult,
  DocumentLotReachResult,
  DocumentLotTarget,
  DocumentTemplateDepositResult,
  DocumentTemplateSaveResult,
} from '@/services/types/domain/document-template-types'

/**
 * Server Actions des modeles de documents (s36, ADR 074). Chacune : tenant
 * du domaine, traductions, controle de session (`requireActionAuth`), puis
 * facade — le service reverifie `document.template.manage`. Un refus est
 * rendu comme un resultat ; le retour se fait par `redirect()` **hors du
 * `try`** : il leve `NEXT_REDIRECT`, qu'un `catch` avalerait.
 */

const NAMESPACE = 'DocumentTemplatesBureau'

const textOf = (formData: FormData, key: string): string => {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

const fieldsOf = (formData: FormData) => ({
  name: textOf(formData, 'name'),
  subject: textOf(formData, 'subject'),
  bodyMarkdown: textOf(formData, 'bodyMarkdown'),
})

const messageKeyOf = (error: unknown): string => {
  if (error instanceof AuthorizationError) return 'errors.forbidden'
  if (error instanceof NotFoundError) return 'errors.notFound'
  return 'errors.failed'
}

const revalidateTemplateScreens = () => {
  revalidatePath(DOCUMENT_TEMPLATES_ROUTE_PATTERN, 'layout')
}

const saveTemplate = async (
  save: (organizationId: string) => Promise<DocumentTemplateSaveResult>
): Promise<DocumentTemplateFormState> => {
  const tenant = await requireCurrentTenantDal()
  const t = await getTranslations(NAMESPACE)
  let templateId: string

  try {
    await requireActionAuth()

    const result = await save(tenant.id)
    if (result.status === 'rejected') return result

    templateId = result.template.id
    revalidateTemplateScreens()
  } catch (error) {
    return {status: 'error', message: t(messageKeyOf(error))}
  }

  redirect(savedDocumentTemplatePathOf(templateId))
}

/** « Enregistrer le modele » d'un nouveau modele (critere 1). */
export async function createDocumentTemplateAction(
  _state: DocumentTemplateFormState,
  formData: FormData
): Promise<DocumentTemplateFormState> {
  return saveTemplate((organizationId) =>
    createDocumentTemplateService({organizationId, ...fieldsOf(formData)})
  )
}

/** « Enregistrer le modele » d'un modele existant. */
export async function updateDocumentTemplateAction(
  _state: DocumentTemplateFormState,
  formData: FormData
): Promise<DocumentTemplateFormState> {
  return saveTemplate((organizationId) =>
    updateDocumentTemplateService({
      organizationId,
      templateId: textOf(formData, 'templateId'),
      ...fieldsOf(formData),
    })
  )
}

/**
 * « Supprimer le modele », apres confirmation : les documents deja deposes
 * restent dans les dossiers, inchanges.
 */
export async function deleteDocumentTemplateAction(
  templateId: string
): Promise<DocumentTemplateFormState> {
  const tenant = await requireCurrentTenantDal()
  const t = await getTranslations(NAMESPACE)

  try {
    await requireActionAuth()

    await deleteDocumentTemplateService({organizationId: tenant.id, templateId})
    revalidateTemplateScreens()
  } catch {
    return {status: 'error', message: t('editor.delete.failed')}
  }

  redirect(DELETED_DOCUMENT_TEMPLATE_PATH)
}

type Translator = Awaited<ReturnType<typeof getTranslations>>

/** La raison d'un depot non abouti, ecrite par le serveur (rapport du lot). */
const failureOf = (
  t: Translator,
  result: Exclude<DocumentTemplateDepositResult, {status: 'deposited'}>
): DocumentLotLineResult => {
  switch (result.status) {
    case 'rejected':
      return {
        status: 'failed',
        reason: t('depositFailures.rejected', {
          details: result.issues
            .map((issue) => t(`depositFailures.issues.${issue}`))
            .join(', '),
        }),
        issues: result.issues,
      }
    case 'unknown_variables':
      return {
        status: 'failed',
        reason: t('depositFailures.unknown_variables', {
          variables: variableListOf(result.variables),
        }),
      }
    default:
      return {status: 'failed', reason: t(`depositFailures.${result.status}`)}
  }
}

const revalidateMemberDocumentScreens = () => {
  revalidatePath(MEMBER_PROFILE_ROUTE_PATTERN, 'layout')
  revalidatePath(MEMBER_DOCUMENTS_ROUTE_PATTERN, 'layout')
  revalidatePath(MEMBER_SPACE_ROUTE_PATTERN, 'page')
}

/**
 * Produit le document d'une fiche et le depose dans son dossier (ecran 3,
 * case cochee ; une ligne du lot, critere 3). **Un appel par fiche** ; le
 * service exige les deux actions, s32 revérifie la sienne. Un echec est rendu
 * pour cette fiche, sa raison traduite ici.
 */
export async function depositTemplateDocumentAction(
  formData: FormData
): Promise<DocumentLotLineResult> {
  const tenant = await requireCurrentTenantDal()
  const t = await getTranslations(NAMESPACE)

  try {
    await requireActionAuth()

    const result = await depositTemplateDocumentService({
      organizationId: tenant.id,
      templateId: textOf(formData, 'templateId'),
      memberProfileId: textOf(formData, 'memberProfileId'),
      documentDate: textOf(formData, 'documentDate'),
      categoryId: textOf(formData, 'categoryId'),
      title: textOf(formData, 'title'),
    })
    if (result.status !== 'deposited') return failureOf(t, result)

    revalidateMemberDocumentScreens()
    return {status: 'deposited', documentId: result.document.id}
  } catch (error) {
    return {
      status: 'failed',
      reason: t(
        error instanceof AuthorizationError
          ? 'depositFailures.forbidden'
          : 'depositFailures.failed'
      ),
    }
  }
}

const reachErrorKeyOf = (error: unknown): string => {
  if (error instanceof CampaignTargetUnavailableError) {
    return 'lot.reachErrors.unpaidUnavailable'
  }
  if (error instanceof NotFoundError) return 'lot.reachErrors.groupNotFound'
  if (error instanceof AuthorizationError) return 'errors.forbidden'
  return 'lot.reachErrors.failed'
}

/**
 * Le decompte d'un lot (ecran 4) : les fiches de la cible, lues une fois.
 * Une lecture en echec est dite, jamais remplacee par « tous » ni « vide ».
 */
export async function getDocumentLotReachAction(
  target: DocumentLotTarget
): Promise<DocumentLotReachResult> {
  const tenant = await requireCurrentTenantDal()
  const t = await getTranslations(NAMESPACE)

  try {
    await requireActionAuth()

    const reach = await getDocumentLotReachService({
      organizationId: tenant.id,
      target,
    })
    return {status: 'ready', reach}
  } catch (error) {
    return {status: 'error', message: t(reachErrorKeyOf(error))}
  }
}
