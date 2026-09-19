import {z} from 'zod'

/**
 * Schema du formulaire de provisioning, cote client.
 *
 * Les messages viennent des traductions, jamais du code : le meme schema est
 * donc construit par une fonction qui recoit `t`
 * (`rule-zod-client-server-internationalization.md`). Le service refait la
 * validation de son cote — c'est lui qui garde la base.
 */
export const createProvisionOrganizationFormSchema = (
  t: (key: string) => string
) =>
  z.object({
    name: z
      .string()
      .min(2, t('validation.nameMin'))
      .max(100, t('validation.nameMax')),
    slug: z
      .string()
      .min(2, t('validation.slugPattern'))
      .regex(/^[a-z0-9-]+$/, t('validation.slugPattern')),
    domain: z
      .string()
      .min(4, t('validation.domainPattern'))
      .regex(
        /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/,
        t('validation.domainPattern')
      ),
    adminEmail: z.string().email(t('validation.adminEmailInvalid')),
    contactEmail: z.string().trim().email(t('validation.contactEmailInvalid')),
  })

export type ProvisionOrganizationFormValues = z.infer<
  ReturnType<typeof createProvisionOrganizationFormSchema>
>
