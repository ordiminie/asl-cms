'use server'

import {revalidatePath} from 'next/cache'
import {after} from 'next/server'
import {getTranslations} from 'next-intl/server'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {CAMPAIGNS_ROUTE_PATTERN} from '@/components/features/campaigns/campaign-paths'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {CampaignTargetUnavailableError} from '@/services/errors/campaign-errors'
import {NotFoundError} from '@/services/errors/not-found-error'
import {
  getCampaignComposerContextService,
  previewCampaignPlanService,
  previewCampaignService,
  sendCampaignService,
} from '@/services/facades/campaign-service-facade'
import {subjectMaxLength} from '@/services/rules/campaign-rules'
import {
  type CampaignFormField,
  type CampaignTarget,
  type CampaignTargetActionResult,
  type CampaignTemplateId,
  type PreviewCampaignActionResult,
  type SendCampaignActionResult,
} from '@/services/types/domain/campaign-types'
import {
  type CampaignFormValues,
  createCampaignFormSchema,
} from '@/services/validation/campaign-validation'

/**
 * Server Actions du composeur de campagnes (s25, ADR 051).
 *
 * Patron de `proprietaires/notes-actions.ts` : tenant du domaine, traductions,
 * controle de session, schema du formulaire (plafond d'objet calcule depuis
 * le nom de l'association), facade — le service reverifie `campaign.manage`.
 * Les erreurs sont rendues en resultats, la saisie reste dans le formulaire ;
 * le contenu n'est jamais journalise ni recopie dans un message.
 *
 * La livraison part par `after()`, posee **ici** (la couche qui tient la
 * requete), seulement apres une creation : tout ce qu'elle lit est deja
 * capture dans la fonction rendue par le service.
 */

type Translator = Awaited<ReturnType<typeof getTranslations>>

type Validated =
  | {valid: true; values: CampaignFormValues}
  | {valid: false; result: {status: 'invalid'; errors: FormErrors}}

type FormErrors = {field: CampaignFormField; message: string}[]

const readField = (formData: FormData, key: string): string =>
  formData.get(key)?.toString() ?? ''

const validateContent = (
  formData: FormData,
  t: Translator,
  associationName: string
): Validated => {
  const validation = createCampaignFormSchema(
    t,
    subjectMaxLength(associationName)
  ).safeParse({
    templateId: readField(formData, 'templateId'),
    subject: readField(formData, 'subject'),
    preheader: readField(formData, 'preheader'),
    bodyMarkdown: readField(formData, 'bodyMarkdown'),
  })
  if (validation.success) return {valid: true, values: validation.data}
  return {
    valid: false,
    result: {
      status: 'invalid',
      errors: validation.error.issues.map((issue) => ({
        field: issue.path[0] as CampaignFormField,
        message: issue.message,
      })),
    },
  }
}

const messageKeyOf = (error: unknown): string => {
  if (error instanceof AuthorizationError) return 'errors.forbidden'
  if (error instanceof CampaignTargetUnavailableError) {
    return 'errors.unpaidUnavailable'
  }
  if (error instanceof NotFoundError) return 'errors.groupNotFound'
  return 'errors.failed'
}

const failureOf = (error: unknown, t: Translator) => ({
  status: 'error' as const,
  message: t(messageKeyOf(error)),
})

/**
 * La cible choisie, lue du formulaire (s27, ADR 060 §1). Rien n'est suppose :
 * un type absent ou inconnu part tel quel, et le service le refuse.
 */
const targetOf = (formData: FormData): CampaignTarget => {
  const kind = readField(formData, 'targetKind')
  if (kind === 'group') {
    return {kind, groupId: readField(formData, 'targetGroupId')}
  }
  return {kind} as CampaignTarget
}

const contentOf = (values: CampaignFormValues) => ({
  templateId: values.templateId as CampaignTemplateId,
  subject: values.subject,
  preheader: values.preheader,
  bodyMarkdown: values.bodyMarkdown,
})

/**
 * « Voir l'apercu » : le rendu final pour un membre reel et le plan d'envoi
 * annonce (s26) ; n'ecrit rien.
 */
export async function previewCampaignAction(
  _prevState: PreviewCampaignActionResult | undefined,
  formData: FormData
): Promise<PreviewCampaignActionResult> {
  const tenant = await requireCurrentTenantDal()
  const t = await getTranslations('CampaignsBureau')

  try {
    await requireActionAuth()

    const validation = validateContent(formData, t, tenant.name)
    if (!validation.valid) return validation.result

    const memberProfileId = readField(formData, 'memberProfileId')
    const target = targetOf(formData)
    const result = await previewCampaignService({
      organizationId: tenant.id,
      ...contentOf(validation.values),
      target,
      ...(memberProfileId ? {memberProfileId} : {}),
    })
    if (result.status !== 'ok') return result

    const plan = await previewCampaignPlanService(tenant.id, target)
    return {status: 'ok', preview: result.preview, plan}
  } catch (error) {
    return failureOf(error, t)
  }
}

/** « Envoyer a N membres », apres confirmation (ecran 3, etat e). */
export async function sendCampaignAction(
  _prevState: SendCampaignActionResult | undefined,
  formData: FormData
): Promise<SendCampaignActionResult> {
  const tenant = await requireCurrentTenantDal()
  const t = await getTranslations('CampaignsBureau')

  try {
    await requireActionAuth()

    const validation = validateContent(formData, t, tenant.name)
    if (!validation.valid) return validation.result

    const result = await sendCampaignService({
      organizationId: tenant.id,
      submissionId: readField(formData, 'submissionId'),
      ...contentOf(validation.values),
      target: targetOf(formData),
    })
    if (result.status !== 'created') return result

    if (result.deliver) after(result.deliver)
    revalidatePath(CAMPAIGNS_ROUTE_PATTERN, 'layout')
    return {status: 'created', campaignId: result.campaignId}
  } catch (error) {
    return failureOf(error, t)
  }
}

/**
 * Le decompte de la cible choisie, relu a chaque changement de cible dans le
 * composeur (s27, critere 5). N'ecrit rien ; le service reverifie le droit et
 * refuse un groupe introuvable.
 */
export async function readCampaignTargetAction(
  target: CampaignTarget
): Promise<CampaignTargetActionResult> {
  const tenant = await requireCurrentTenantDal()
  const t = await getTranslations('CampaignsBureau')

  try {
    await requireActionAuth()

    const context = await getCampaignComposerContextService(tenant.id, target)
    return {
      status: 'ok',
      counts: context.counts,
      reachableMembers: context.reachableMembers,
    }
  } catch (error) {
    return failureOf(error, t)
  }
}
