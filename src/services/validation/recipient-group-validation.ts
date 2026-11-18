import {z} from 'zod'

import {MEMBER_PROFILES_PAGE_SIZE} from '../types/domain/member-profile-types'
import {RECIPIENT_GROUP_NAME_MAX_LENGTH} from '../types/domain/recipient-group-types'

/**
 * Validation des groupes de destinataires (s27, ADR 060 §4). Le nom est borne
 * ici **et** par le formulaire : le schema du formulaire n'est pas la garde.
 * La selection vaut pour la page affichee de la liste des proprietaires : elle
 * ne depasse jamais une page.
 */

const uuid = z.string().uuid()

export const recipientGroupOrganizationIdSchema = uuid

export const recipientGroupNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(RECIPIENT_GROUP_NAME_MAX_LENGTH)

export const recipientGroupScopeServiceSchema = z.object({
  organizationId: uuid,
  groupId: uuid,
})

export const createRecipientGroupServiceSchema = z.object({
  organizationId: uuid,
  name: recipientGroupNameSchema,
})

export const renameRecipientGroupServiceSchema =
  recipientGroupScopeServiceSchema.extend({name: recipientGroupNameSchema})

export const recipientGroupMembersServiceSchema =
  recipientGroupScopeServiceSchema.extend({
    memberProfileIds: z
      .array(uuid)
      .min(1)
      .max(MEMBER_PROFILES_PAGE_SIZE)
      .transform((ids) => [...new Set(ids)]),
  })

type Translate = (
  key: string,
  values?: Record<string, string | number>
) => string

/**
 * Le formulaire « Nom du groupe » (creer, renommer), partage par le client
 * (React Hook Form) et par les actions serveur, messages traduits.
 */
export const createRecipientGroupFormSchema = (t: Translate) =>
  z.object({
    name: z
      .string()
      .trim()
      .min(1, {message: t('validation.nameRequired')})
      .max(RECIPIENT_GROUP_NAME_MAX_LENGTH, {
        message: t('validation.nameTooLong', {
          max: RECIPIENT_GROUP_NAME_MAX_LENGTH,
        }),
      }),
  })

export type RecipientGroupFormValues = z.infer<
  ReturnType<typeof createRecipientGroupFormSchema>
>
