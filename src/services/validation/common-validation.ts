import z from 'zod'

export const uuidSchema = z.string().uuid({
  message: "L'identifiant n'est pas valide.",
})
