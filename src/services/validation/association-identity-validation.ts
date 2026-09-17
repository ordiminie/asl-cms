import {z} from 'zod'

import {ASSOCIATION_IDENTITY_KINDS} from '../types/domain/association-identity-types'

export const associationIdentityKindSchema = z.enum(ASSOCIATION_IDENTITY_KINDS)

export const replaceAssociationIdentityFileServiceSchema = z.object({
  organizationId: z.string().uuid(),
  kind: associationIdentityKindSchema,
  file: z.instanceof(Blob),
})

export const readAssociationIdentityFileServiceSchema = z.object({
  organizationId: z.string().uuid(),
  kind: associationIdentityKindSchema,
  key: z.string().min(1),
})
