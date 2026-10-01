import {z} from 'zod'

/** Validation du sitemap d'une association (s11). */
export const sitemapOrganizationIdSchema = z.string().uuid()
