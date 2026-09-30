import {z} from 'zod'

import {
  REPORT_DESCRIPTION_MAX_LENGTH,
  REPORT_LOCATION_MAX_LENGTH,
  REPORT_STATUSES,
  REPORTER_NAME_MAX_LENGTH,
  REPORTER_PHONE_MAX_LENGTH,
  REPORTER_PHONE_PATTERN,
  ReportStatus,
} from '../types/domain/incident-report-types'

/**
 * Validation des signalements (s10, decision G) et de leurs transitions de
 * statut (decision C).
 */

export const incidentReportOrganizationIdSchema = z.string().uuid()
export const incidentReportIdSchema = z.string().uuid()
export const incidentReportPageNumberSchema = z.number().int().min(1)
export const reportStatusSchema = z.enum(REPORT_STATUSES)

const isNotBlank = (value: string) => value.trim().length > 0

/** Une coordonnee facultative : vide ou faite d'espaces, elle est absente. */
const optionalContact = (schema: z.ZodString) =>
  z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim()
      return trimmed ? trimmed : undefined
    })
    .pipe(schema.optional())
    .transform((value) => value ?? null)

export const createIncidentReportServiceSchema = z.object({
  organizationId: incidentReportOrganizationIdSchema,
  locale: z.string(),
  categoryId: z.string().uuid().optional(),
  location: z.string().trim().min(1).max(REPORT_LOCATION_MAX_LENGTH),
  description: z.string().max(REPORT_DESCRIPTION_MAX_LENGTH).refine(isNotBlank),
  name: optionalContact(z.string().max(REPORTER_NAME_MAX_LENGTH)),
  email: optionalContact(z.string().email()),
  phone: optionalContact(
    z.string().max(REPORTER_PHONE_MAX_LENGTH).regex(REPORTER_PHONE_PATTERN)
  ),
})

export const incidentReportsPageServiceSchema = z.object({
  organizationId: incidentReportOrganizationIdSchema,
  page: incidentReportPageNumberSchema,
})

export const incidentReportServiceSchema = z.object({
  organizationId: incidentReportOrganizationIdSchema,
  reportId: incidentReportIdSchema,
})

export const changeIncidentReportStatusServiceSchema =
  incidentReportServiceSchema.extend({to: reportStatusSchema})

/**
 * Le statut suivant, dans l'ordre `reported` → `in_progress` → `resolved`
 * (decision C) : un seul pas, pas de retour, pas de saut. `null` apres
 * `resolved`.
 */
export const nextReportStatusOf = (status: ReportStatus): ReportStatus | null =>
  REPORT_STATUSES[REPORT_STATUSES.indexOf(status) + 1] ?? null

/** Le seul statut depuis lequel `to` est atteignable, ou `null`. */
export const previousReportStatusOf = (to: ReportStatus): ReportStatus | null =>
  REPORT_STATUSES.find((status) => nextReportStatusOf(status) === to) ?? null

/** Le statut `current` est-il deja arrive a `to`, ou au-dela ? */
export const hasReachedReportStatus = (
  current: ReportStatus,
  to: ReportStatus
): boolean => REPORT_STATUSES.indexOf(current) >= REPORT_STATUSES.indexOf(to)
