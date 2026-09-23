import {z} from 'zod'

/** Lecture d'un fichier de contenu : la cle vient de la requete. */
export const readContentFileServiceSchema = z.object({
  organizationId: z.string().uuid(),
  key: z.string().min(1).max(512),
})
