import {z} from 'zod'

import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import {
  CreateMember,
  CreateOrganization,
  Organization,
  ORGANIZATION_MODULES,
  OrganizationModule,
  OrganizationRole,
  UpdateOrganization,
} from '../types/domain/organization-types'

export const baseOrganizationServiceSchema = z.object({
  name: z
    .string()
    .min(2, {
      message: 'Le nom doit contenir au moins 2 caractères.',
    })
    .max(100, {
      message: 'Le nom ne doit pas contenir plus de 100 caractères.',
    }),
  slug: z
    .string()
    .min(2, {
      message: 'Le slug doit contenir au moins 2 caractères.',
    })
    .max(100, {
      message: 'Le slug ne doit pas contenir plus de 100 caractères.',
    })
    .regex(/^[a-z0-9-]+$/, {
      message:
        'Le slug ne peut contenir que des lettres minuscules, chiffres et tirets.',
    }),
}) satisfies z.Schema<Pick<Organization, 'name' | 'slug'>>

export const createOrganizationServiceSchema =
  baseOrganizationServiceSchema.extend({
    description: z.string().optional(),
    logo: z.string().optional(),
  }) satisfies z.Schema<CreateOrganization>

export const updateOrganizationServiceSchema =
  baseOrganizationServiceSchema.extend({
    id: z.string().uuid(),
    description: z.string().optional(),
    logo: z.string().optional(),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
    limitOverrides: z.record(z.string(), z.number()).optional(),
  }) satisfies z.Schema<UpdateOrganization>

export const organizationRoleSchema = z.enum([
  UserOrganizationRoleConst.OWNER,
  UserOrganizationRoleConst.ADMIN,
  UserOrganizationRoleConst.MEMBER,
]) satisfies z.Schema<OrganizationRole>

export const createUserOrganizationServiceSchema = z.object({
  userId: z.string().uuid({
    message: "L'identifiant utilisateur n'est pas valide.",
  }),
  organizationId: z.string().uuid({
    message: "L'identifiant organisation n'est pas valide.",
  }),
  createdAt: z.date(),
  role: organizationRoleSchema.default(UserOrganizationRoleConst.MEMBER),
}) satisfies z.Schema<CreateMember>

export const organizationUuidSchema = z.string().uuid({
  message: "L'identifiant organisation n'est pas valide.",
})

export const userUuidSchema = z.string().uuid({
  message: "L'identifiant utilisateur n'est pas valide.",
})

/**
 * Un domaine, pas une URL : ni schema, ni chemin, ni port. La casse est
 * abaissee ici pour que la colonne unique porte une seule forme du meme
 * domaine (ADR 003 : un domaine par association).
 */
export const organizationDomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(4, {message: "Le domaine n'est pas valide."})
  .max(253, {message: 'Le domaine est trop long.'})
  .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/, {
    message:
      "Le domaine n'est pas valide. Attendu : asl-lafourche.fr, sans https:// ni chemin.",
  })

export const organizationModuleSchema = z.enum(
  ORGANIZATION_MODULES as [OrganizationModule, ...OrganizationModule[]],
  {
    message: "Cette cle de module n'existe pas.",
  }
) satisfies z.Schema<OrganizationModule>

/**
 * Provisionner une association : nom, identifiant court, domaine, modules
 * actifs et adresse de l'administrateur initial. L'administrateur est designe
 * **par email** — jamais par un identifiant existant, puisque son compte peut
 * ne pas exister encore.
 */
export const provisionOrganizationServiceSchema =
  baseOrganizationServiceSchema.extend({
    domain: organizationDomainSchema,
    adminEmail: z.string().trim().toLowerCase().email({
      message: "L'adresse email de l'administrateur n'est pas valide.",
    }),
    contactEmail: z.string().trim().email({
      message:
        "L'adresse de contact de l'association est obligatoire et doit être valide.",
    }),
    enabledModules: z.array(organizationModuleSchema).default([]),
  })

export const updateOrganizationModulesServiceSchema = z.object({
  organizationId: organizationUuidSchema,
  enabledModules: z.array(organizationModuleSchema),
})
