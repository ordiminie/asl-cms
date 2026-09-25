import {z} from 'zod'

import {
  SITE_ALERT_MAX_LENGTH,
  SITE_ALERT_MESSAGE_REQUIRED,
  SITE_ALERT_MESSAGE_TOO_LONG,
} from '../types/domain/site-alert-types'

/**
 * Validation du bandeau d'alerte (s07), hors du registre typé des parametres
 * (ADR 021). Le message est du texte brut : seuls les espaces de bord sont
 * retires, le reste est conserve tel quel. Un message vide est accepte tant
 * que le bandeau est masque — il ne l'est pas quand on l'affiche.
 */

export const siteAlertOrganizationIdSchema = z.string().uuid()

export const saveSiteAlertServiceSchema = z
  .object({
    organizationId: siteAlertOrganizationIdSchema,
    message: z
      .string()
      .trim()
      .max(SITE_ALERT_MAX_LENGTH, {message: SITE_ALERT_MESSAGE_TOO_LONG}),
    active: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.active && value.message === '') {
      context.addIssue({
        code: 'custom',
        path: ['message'],
        message: SITE_ALERT_MESSAGE_REQUIRED,
      })
    }
  })
