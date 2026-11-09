'use server'

import {redirect} from 'next/navigation'
import {getTranslations} from 'next-intl/server'

import {getActiveReportCategoriesDal} from '@/app/dal/association-category-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {resolveSupportedLocale} from '@/lib/helper/locale-helper'
import {createMyIncidentReportService} from '@/services/facades/incident-report-service-facade'

import {
  createMyReportFormSchema,
  MY_REPORT_FORM_FIELDS,
  type MyReportFormField,
  type MyReportFormState,
} from './my-report-form-validation'

/** Retour a l'espace membre apres l'envoi (etat A5 du design). */
const MY_REPORT_SENT_PATH = '/dashboard?signalement=envoye'

const FAILED: MyReportFormState = {status: 'failed'}

const readField = (formData: FormData, key: string): string =>
  formData.get(key)?.toString() ?? ''

/**
 * Declaration d'un incident par le membre connecte (s22, ADR 049).
 *
 * Ordre : session -> tenant du domaine appele -> validation (categories
 * offertes comprises) -> ecriture et notification par la facade -> retour a
 * l'espace. Seuls la categorie, le lieu et la description sont lus dans le
 * `FormData` : une identite ou un `memberId` glisse n'atteint jamais le
 * service, qui resout la fiche par la session. **Aucun quota** pour un
 * membre connecte (arbitrage V1).
 */
export async function submitMyReportAction(
  _prevState: MyReportFormState,
  formData: FormData
): Promise<MyReportFormState> {
  try {
    await requireActionAuth()
  } catch {
    return FAILED
  }

  const tenant = await requireCurrentTenantDal()
  const locale = resolveSupportedLocale(formData.get('locale'))
  const t = await getTranslations({locale, namespace: 'ReportPage'})

  const categories = await getActiveReportCategoriesDal(tenant.id)
  const validation = createMyReportFormSchema(
    t,
    categories.map((category) => category.id)
  ).safeParse(
    Object.fromEntries(
      MY_REPORT_FORM_FIELDS.map((field) => [field, readField(formData, field)])
    )
  )
  if (!validation.success) {
    return {
      status: 'invalid',
      errors: validation.error.issues.map((issue) => ({
        field: issue.path[0] as MyReportFormField,
        message: issue.message,
      })),
    }
  }

  const values = validation.data
  const categoryId = categories.length > 0 ? values.categoryId : undefined
  try {
    const result = await createMyIncidentReportService({
      organizationId: tenant.id,
      locale,
      ...(categoryId ? {categoryId} : {}),
      location: values.location,
      description: values.description,
    })
    if (result.status === 'not_found') return FAILED
  } catch {
    return FAILED
  }

  redirect(MY_REPORT_SENT_PATH)
}
