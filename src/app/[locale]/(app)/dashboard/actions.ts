'use server'

import {revalidatePath} from 'next/cache'
import {getTranslations} from 'next-intl/server'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {
  createMemberPostalContactFormSchema,
  MEMBER_POSTAL_CONTACT_FORM_FIELDS,
  type MemberPostalContactFormField,
  type MyContactActionResult,
} from '@/components/features/member-profile/member-profile-form-validation'
import {updateMyContactService} from '@/services/facades/member-space-service-facade'

/**
 * Server Action de l'espace membre (s16, ADR 040). Seuls les champs postaux
 * et le telephone sont lus dans le `FormData` : un identifiant de fiche ou un
 * email glisse dans la requete n'atteint jamais le service, qui resout la
 * fiche par la session et le domaine appele.
 */

const DASHBOARD_ROUTE_PATTERN = '/[locale]/(app)/dashboard'

const readFields = <Field extends string>(
  formData: FormData,
  fields: readonly Field[]
): Record<Field, string> =>
  Object.fromEntries(
    fields.map((field) => [field, formData.get(field)?.toString() ?? ''])
  ) as Record<Field, string>

const toFieldErrors = (
  issues: readonly {path: PropertyKey[]; message: string}[]
): {field: MemberPostalContactFormField; message: string}[] =>
  issues.map((issue) => ({
    field: issue.path[0] as MemberPostalContactFormField,
    message: issue.message,
  }))

/** « Enregistrer mes coordonnees » depuis la carte « Mes coordonnees ». */
export async function updateMyContactAction(
  _prevState: MyContactActionResult | undefined,
  formData: FormData
): Promise<MyContactActionResult> {
  const tenant = await requireCurrentTenantDal()
  const t = await getTranslations('BureauMemberProfilesPage')
  const failure = {status: 'error', message: t('errors.failed')} as const

  try {
    await requireActionAuth()

    const validation = createMemberPostalContactFormSchema(t).safeParse(
      readFields(formData, MEMBER_POSTAL_CONTACT_FORM_FIELDS)
    )
    if (!validation.success) {
      return {
        status: 'invalid',
        errors: toFieldErrors(validation.error.issues),
      }
    }

    const result = await updateMyContactService({
      organizationId: tenant.id,
      ...validation.data,
    })
    if (result.status === 'not_found') return failure

    revalidatePath(DASHBOARD_ROUTE_PATTERN, 'page')
    return {status: 'saved', contact: result.contact}
  } catch {
    return failure
  }
}
