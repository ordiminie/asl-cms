'use server'

import {revalidatePath} from 'next/cache'
import {getLocale, getTranslations} from 'next-intl/server'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {createMemberEmailFormSchema} from '@/components/features/member-profile/member-profile-email-validation'
import {
  MY_EMAIL_FORM_FIELDS,
  type MyEmailActionResult,
} from '@/components/features/member-space/my-emails-validation'
import {
  addMyEmailService,
  cancelMyPendingEmailService,
  correctMyPendingEmailService,
  updateMyEmailService,
} from '@/services/facades/my-email-service-facade'
import type {MyEmailWriteResult} from '@/services/types/domain/member-email-types'

/**
 * Server Actions de « Mes adresses email » (s54, ecran 1). Seuls l'adresse
 * saisie et, pour Modifier / Gerer, l'identifiant de la ligne sont lus dans
 * le `FormData` : un identifiant de fiche, d'association ou d'auteur glisse
 * dans la requete n'atteint jamais le service, qui resout les fiches par la
 * session et le domaine appele, et revérifie que la ligne est la sienne.
 */

const DASHBOARD_ROUTE_PATTERN = '/[locale]/(app)/dashboard'

type Translator = Awaited<ReturnType<typeof getTranslations>>

const readField = (formData: FormData, key: string): string =>
  formData.get(key)?.toString() ?? ''

const failureOf = (t: Translator): MyEmailActionResult => ({
  status: 'error',
  message: t('errors.failed'),
})

/** Un envoi de lien revalide l'espace ; un refus n'a rien ecrit. */
const toActionResult = (
  result: MyEmailWriteResult,
  t: Translator
): MyEmailActionResult => {
  if (result.status === 'not_found') return failureOf(t)
  if (result.status === 'sent' || result.status === 'deferred') {
    revalidatePath(DASHBOARD_ROUTE_PATTERN, 'page')
  }
  return result
}

type EmailWrite = (input: {
  organizationId: string
  email: string
  locale: string
  emailId: string
}) => Promise<MyEmailWriteResult>

const runEmailWrite = async (
  formData: FormData,
  write: EmailWrite
): Promise<MyEmailActionResult> => {
  const tenant = await requireCurrentTenantDal()
  const t = await getTranslations('MemberSpacePage.emails')

  try {
    await requireActionAuth()

    const validation = createMemberEmailFormSchema(t).safeParse({
      email: readField(formData, MY_EMAIL_FORM_FIELDS.email),
    })
    if (!validation.success) {
      return {
        status: 'invalid',
        message: validation.error.issues[0]?.message ?? '',
      }
    }

    return toActionResult(
      await write({
        organizationId: tenant.id,
        email: validation.data.email.trim(),
        locale: await getLocale(),
        emailId: readField(formData, MY_EMAIL_FORM_FIELDS.emailId),
      }),
      t
    )
  } catch {
    return failureOf(t)
  }
}

/** « Envoyer le lien de confirmation » (1b). */
export async function addMyEmailAction(
  _prevState: MyEmailActionResult | undefined,
  formData: FormData
): Promise<MyEmailActionResult> {
  return runEmailWrite(formData, ({organizationId, email, locale}) =>
    addMyEmailService({organizationId, email, locale})
  )
}

/** « Modifier » sa propre adresse (1e). */
export async function updateMyEmailAction(
  _prevState: MyEmailActionResult | undefined,
  formData: FormData
): Promise<MyEmailActionResult> {
  return runEmailWrite(formData, (input) => updateMyEmailService(input))
}

/** « Gerer » une attente : la corriger et renvoyer le lien. */
export async function correctMyPendingEmailAction(
  _prevState: MyEmailActionResult | undefined,
  formData: FormData
): Promise<MyEmailActionResult> {
  return runEmailWrite(formData, (input) => correctMyPendingEmailService(input))
}

/** « Gerer » une attente : l'annuler. */
export async function cancelMyPendingEmailAction(
  _prevState: MyEmailActionResult | undefined,
  formData: FormData
): Promise<MyEmailActionResult> {
  const tenant = await requireCurrentTenantDal()
  const t = await getTranslations('MemberSpacePage.emails')

  try {
    await requireActionAuth()
    const result = await cancelMyPendingEmailService({
      organizationId: tenant.id,
      emailId: readField(formData, MY_EMAIL_FORM_FIELDS.emailId),
    })
    revalidatePath(DASHBOARD_ROUTE_PATTERN, 'page')
    return result
  } catch {
    return failureOf(t)
  }
}
