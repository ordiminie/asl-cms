import {z} from 'zod'

import {
  CAMPAIGN_BODY_MAX,
  CAMPAIGN_PREHEADER_MAX,
  CAMPAIGN_RECIPIENT_FILTERS,
  CAMPAIGN_TEMPLATE_IDS,
} from '../types/domain/campaign-types'

/**
 * Validation des campagnes (s25, ADR 051). Le plafond de l'objet depend du nom
 * de l'association (prefixe ajoute a l'envoi) : les schemas qui le portent
 * sont des fabriques. Le schema du formulaire n'est pas la garde : le service
 * revalide tout.
 */

const uuid = z.string().uuid()

const isNotBlank = (value: string) => value.trim().length > 0

const isSingleLine = (value: string) => !/[\r\n]/.test(value)

const campaignContentServiceSchema = (subjectMax: number) =>
  z.object({
    organizationId: uuid,
    templateId: z.enum(CAMPAIGN_TEMPLATE_IDS),
    subject: z.string().max(subjectMax).refine(isNotBlank).refine(isSingleLine),
    preheader: z.string().max(CAMPAIGN_PREHEADER_MAX).refine(isSingleLine),
    bodyMarkdown: z.string().max(CAMPAIGN_BODY_MAX).refine(isNotBlank),
  })

export const createPreviewCampaignServiceSchema = (subjectMax: number) =>
  campaignContentServiceSchema(subjectMax).extend({
    memberProfileId: uuid.optional(),
  })

export const createSendCampaignServiceSchema = (subjectMax: number) =>
  campaignContentServiceSchema(subjectMax).extend({submissionId: uuid})

export const campaignsPageServiceSchema = z.object({
  organizationId: uuid,
  page: z.number().int().min(1),
})

export const campaignByIdServiceSchema = z.object({
  organizationId: uuid,
  campaignId: uuid,
})

export const campaignRecipientsServiceSchema = z.object({
  organizationId: uuid,
  campaignId: uuid,
  filter: z.enum(CAMPAIGN_RECIPIENT_FILTERS),
  page: z.number().int().min(1),
})

/** Un jeton de desinscription : 32 octets en base64url, sans remplissage. */
export const unsubscribeTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/)

type Translate = (
  key: string,
  values?: Record<string, string | number>
) => string

const boundedText = (t: Translate, max: number, requiredKey: string | null) =>
  z.string().superRefine((value, context) => {
    if (requiredKey && !isNotBlank(value)) {
      context.addIssue({code: 'custom', message: t(requiredKey)})
      return
    }
    if (value.length > max) {
      context.addIssue({
        code: 'custom',
        message: t('composer.validation.tooLong', {count: value.length - max}),
      })
    }
  })

/**
 * Le formulaire du composeur (ecran 2, etats c et d). Partage par le client
 * (React Hook Form) et par les actions serveur.
 */
export const createCampaignFormSchema = (t: Translate, subjectMax: number) =>
  z.object({
    templateId: z.enum(CAMPAIGN_TEMPLATE_IDS, {
      message: t('composer.validation.templateRequired'),
    }),
    subject: boundedText(t, subjectMax, 'composer.validation.subjectRequired'),
    preheader: boundedText(t, CAMPAIGN_PREHEADER_MAX, null),
    bodyMarkdown: boundedText(
      t,
      CAMPAIGN_BODY_MAX,
      'composer.validation.bodyRequired'
    ),
  })

export type CampaignFormValues = z.infer<
  ReturnType<typeof createCampaignFormSchema>
>

/** Une demande de desinscription : l'association du domaine, et le jeton. */
export const unsubscribeRequestServiceSchema = z.object({
  organizationId: uuid,
  token: z.string(),
})
