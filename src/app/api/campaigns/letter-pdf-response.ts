import 'server-only'

import {AuthorizationError} from '@/services/errors/authorization-error'
import {ValidationParsedZodError} from '@/services/errors/validation-error'

/**
 * Reponses des telechargements du courrier (s28) : le PDF porte noms et
 * domiciles des membres, donc jamais en cache ; un refus ne dit rien de plus
 * que son statut.
 */
const BASE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
} as const

export const emptyResponse = (status: number): Response =>
  new Response(null, {status, headers: BASE_HEADERS})

/**
 * Un PDF en piece jointe, sous un nom sans donnee nominative. Des en-tetes
 * en plus peuvent l'accompagner (decomptes du lot) : jamais un nom.
 */
export const pdfAttachment = (
  pdf: Uint8Array,
  fileName: string,
  extraHeaders: Record<string, string> = {}
): Response =>
  new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      ...BASE_HEADERS,
      ...extraHeaders,
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })

/** Un refus d'autorisation : 403 ; un identifiant invalide : 404. */
export const refusalResponseOf = (error: unknown): Response => {
  if (error instanceof AuthorizationError) return emptyResponse(403)
  if (error instanceof ValidationParsedZodError) return emptyResponse(404)
  throw error
}
