'use server'

import {getTranslations} from 'next-intl/server'

import {getActiveReportCategoriesDal} from '@/app/dal/association-category-dal'
import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {resolveSupportedLocale} from '@/lib/helper/locale-helper'
import {readVisitorIp} from '@/lib/helper/visitor-ip'
import {createIncidentReportService} from '@/services/facades/incident-report-service-facade'
import {consumeContactMessageQuotaService} from '@/services/facades/rate-limit-service-facade'

import {
  createReportFormSchema,
  REPORT_FORM_FIELDS,
  type ReportFormField,
} from './report-form-validation'

export type ReportFormError = {field: ReportFormField; message: string}

/**
 * De quoi ecrire la phrase de rappel du succes (etats `1.C` / `1.F` du
 * design) : les coordonnees laissees, rien d'autre. Jamais l'etat de la
 * notification au bureau.
 */
export type ReportRecontact = {phone?: string; email?: string}

export type ReportFormState =
  | {status: 'idle'}
  | {status: 'sent'; recontact: ReportRecontact}
  | {status: 'invalid'; errors: ReportFormError[]}
  | {status: 'rate_limited'; limit: number}

const readField = (formData: FormData, key: string): string =>
  formData.get(key)?.toString() ?? ''

/** Une valeur saisie, ou rien si elle est vide. */
const filled = (value: string): string | undefined => value.trim() || undefined

/**
 * Envoi d'un signalement au bureau depuis `/signaler` (s10).
 *
 * **Action publique, sans `requireActionAuth()`, et c'est delibere** : l'auteur
 * est un visiteur sans compte (precedent : `submitContactAction`). Meme ordre
 * que le contact (s08 decision C, s08b decision F) : tenant du domaine appele
 * -> validation par le schema partage (categories offertes comprises) ->
 * consommation du quota du visiteur -> ecriture et notification par la
 * facade. Une soumission invalide ne coute ni quota, ni ecriture, ni email.
 *
 * Le quota est **celui du contact** (decision E) : meme usage, meme seuil, un
 * seul compteur pour tous les formulaires publics. L'adresse IP n'est
 * transmise qu'au limiteur, jamais au service des signalements.
 */
export async function submitReportAction(
  _prevState: ReportFormState,
  formData: FormData
): Promise<ReportFormState> {
  const locale = resolveSupportedLocale(formData.get('locale'))
  const t = await getTranslations({locale, namespace: 'ReportPage'})

  const tenant = await getCurrentTenantDal()
  if (!tenant) {
    throw new Error("Aucune association n'est servie par ce domaine")
  }

  const categories = await getActiveReportCategoriesDal(tenant.id)
  const validation = createReportFormSchema(
    t,
    categories.map((category) => category.id)
  ).safeParse(
    Object.fromEntries(
      REPORT_FORM_FIELDS.map((field) => [field, readField(formData, field)])
    )
  )
  if (!validation.success) {
    return {
      status: 'invalid',
      errors: validation.error.issues.map((issue) => ({
        field: issue.path[0] as ReportFormField,
        message: issue.message,
      })),
    }
  }

  const quota = await consumeContactMessageQuotaService({
    organizationId: tenant.id,
    ip: await readVisitorIp(),
  })
  if (!quota.allowed) {
    return {status: 'rate_limited', limit: quota.limit}
  }

  const values = validation.data
  const categoryId = categories.length > 0 ? values.categoryId : undefined
  const name = filled(values.name)
  const email = filled(values.email)
  const phone = filled(values.phone)
  await createIncidentReportService({
    organizationId: tenant.id,
    locale,
    ...(categoryId ? {categoryId} : {}),
    location: values.location,
    description: values.description,
    ...(name ? {name} : {}),
    ...(email ? {email} : {}),
    ...(phone ? {phone} : {}),
  })

  return {
    status: 'sent',
    recontact: {...(phone ? {phone} : {}), ...(email ? {email} : {})},
  }
}
