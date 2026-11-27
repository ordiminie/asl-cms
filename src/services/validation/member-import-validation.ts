import {z} from 'zod'

/** L'import initial des membres (s13) : une association, un fichier brut. */
export const importMembersServiceSchema = z.object({
  organizationId: z.string().uuid(),
  content: z.instanceof(Uint8Array),
})

/** La mise a jour annuelle (s56) : l'association du domaine, un fichier brut. */
export const importAnnualMemberContactsServiceSchema =
  importMembersServiceSchema
