'use server'

import {redirect} from 'next/navigation'
import {getTranslations} from 'next-intl/server'

import {getMyQuestionCategoriesDal} from '@/app/dal/member-question-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {resolveSupportedLocale} from '@/lib/helper/locale-helper'
import {createMyQuestionService} from '@/services/facades/member-question-service-facade'

import {
  createMyQuestionFormSchema,
  MY_QUESTION_FORM_FIELDS,
  type MyQuestionFormField,
  type MyQuestionFormState,
} from './question-form-validation'

/** Retour a l'espace membre apres l'envoi (etat A2 du design). */
const MY_QUESTION_SENT_PATH = '/dashboard?question=envoyee'

const FAILED: MyQuestionFormState = {status: 'failed'}

const readField = (formData: FormData, key: string): string =>
  formData.get(key)?.toString() ?? ''

/**
 * Question du membre connecte au bureau (s23, ADR 049).
 *
 * Ordre : session -> tenant du domaine appele -> sujets offerts ->
 * validation -> ecriture et notification par la facade -> retour a l'espace.
 * Seuls le sujet et le texte sont lus dans le `FormData` : une identite ou un
 * `memberId` glisse n'atteint jamais le service, qui resout la fiche par la
 * session. Un echec de notification n'empeche pas le retour : la question est
 * enregistree, le bureau la voit.
 */
export async function submitMyQuestionAction(
  _prevState: MyQuestionFormState,
  formData: FormData
): Promise<MyQuestionFormState> {
  try {
    await requireActionAuth()
  } catch {
    return FAILED
  }

  const tenant = await requireCurrentTenantDal()
  const locale = resolveSupportedLocale(formData.get('locale'))
  const t = await getTranslations({locale, namespace: 'MemberQuestionPage'})

  const categories = await getMyQuestionCategoriesDal()
  if (!categories) return FAILED

  const validation = createMyQuestionFormSchema(
    t,
    categories.map((category) => category.id)
  ).safeParse(
    Object.fromEntries(
      MY_QUESTION_FORM_FIELDS.map((field) => [
        field,
        readField(formData, field),
      ])
    )
  )
  if (!validation.success) {
    return {
      status: 'invalid',
      errors: validation.error.issues.map((issue) => ({
        field: issue.path[0] as MyQuestionFormField,
        message: issue.message,
      })),
    }
  }

  try {
    const result = await createMyQuestionService({
      organizationId: tenant.id,
      locale,
      categoryId: validation.data.categoryId,
      body: validation.data.body,
    })
    if (result.status === 'not_found') return FAILED
  } catch {
    return FAILED
  }

  redirect(MY_QUESTION_SENT_PATH)
}
