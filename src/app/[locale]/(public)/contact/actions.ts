'use server'

import {getTranslations} from 'next-intl/server'

import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {resolveSupportedLocale} from '@/lib/helper/locale-helper'
import {createContactMessageService} from '@/services/facades/contact-message-service-facade'

import {
  type ContactFormField,
  createContactFormSchema,
} from './contact-form-validation'

export type ContactFormError = {field: ContactFormField; message: string}

export type ContactFormState =
  | {status: 'idle'}
  | {status: 'sent'}
  | {status: 'invalid'; errors: ContactFormError[]}

const readField = (formData: FormData, key: string): string =>
  formData.get(key)?.toString() ?? ''

/**
 * Envoi d'un message au bureau depuis `/contact` (s08).
 *
 * **Action publique, sans `requireActionAuth()`, et c'est delibere** : l'auteur
 * est un visiteur sans compte (precedent : `requestMagicLinkAction`). Ordre
 * (decision C) : tenant du domaine appele -> validation par le schema partage
 * -> ecriture et notification par la facade. Une soumission invalide ne coute
 * ni ecriture ni email. Aucune adresse IP n'est lue ni transmise.
 *
 * La locale vient du formulaire, verifiee contre le routage : une Server
 * Action ne voit que le cookie `NEXT_LOCALE`, absent d'un navigateur neuf.
 */
export async function submitContactAction(
  _prevState: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  const locale = resolveSupportedLocale(formData.get('locale'))
  const t = await getTranslations({locale, namespace: 'ContactPage'})

  const tenant = await getCurrentTenantDal()
  if (!tenant) {
    throw new Error("Aucune association n'est servie par ce domaine")
  }

  const validation = createContactFormSchema(t).safeParse({
    name: readField(formData, 'name'),
    email: readField(formData, 'email'),
    subject: readField(formData, 'subject'),
    content: readField(formData, 'content'),
  })
  if (!validation.success) {
    return {
      status: 'invalid',
      errors: validation.error.issues.map((issue) => ({
        field: issue.path[0] as ContactFormField,
        message: issue.message,
      })),
    }
  }

  const {name, email, subject, content} = validation.data
  await createContactMessageService({
    organizationId: tenant.id,
    locale,
    ...(name?.trim() ? {name} : {}),
    email,
    subject,
    body: content,
  })

  return {status: 'sent'}
}
