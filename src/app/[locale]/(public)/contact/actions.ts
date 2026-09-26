'use server'

import {headers} from 'next/headers'
import {getTranslations} from 'next-intl/server'

import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {resolveSupportedLocale} from '@/lib/helper/locale-helper'
import {createContactMessageService} from '@/services/facades/contact-message-service-facade'
import {consumeContactMessageQuotaService} from '@/services/facades/rate-limit-service-facade'

import {
  type ContactFormField,
  createContactFormSchema,
} from './contact-form-validation'

export type ContactFormError = {field: ContactFormField; message: string}

export type ContactFormState =
  | {status: 'idle'}
  | {status: 'sent'}
  | {status: 'invalid'; errors: ContactFormError[]}
  | {status: 'rate_limited'; limit: number}

const readField = (formData: FormData, key: string): string =>
  formData.get(key)?.toString() ?? ''

/**
 * Adresse IP du visiteur : la **derniere** entree de `x-forwarded-for`, celle
 * qu'ajoute le reverse proxy de confiance, sinon `x-real-ip`. Jamais la
 * premiere, fournie par le client : un limiteur qui la lit se contourne en
 * changeant une valeur d'en-tete (s08b, decision B).
 */
const readVisitorIp = async (): Promise<string | undefined> => {
  const requestHeaders = await headers()
  const forwarded = requestHeaders
    .get('x-forwarded-for')
    ?.split(',')
    .map((entry) => entry.trim())
    .findLast((entry) => entry !== '')
  return forwarded ?? requestHeaders.get('x-real-ip')?.trim() ?? undefined
}

/**
 * Envoi d'un message au bureau depuis `/contact` (s08).
 *
 * **Action publique, sans `requireActionAuth()`, et c'est delibere** : l'auteur
 * est un visiteur sans compte (precedent : `requestMagicLinkAction`). Ordre
 * (s08 decision C, s08b decision F) : tenant du domaine appele -> validation
 * par le schema partage -> consommation du quota du visiteur -> ecriture et
 * notification par la facade. Une soumission invalide ne coute ni quota, ni
 * ecriture, ni email. L'adresse IP n'est transmise qu'au limiteur, jamais au
 * service des messages.
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

  const quota = await consumeContactMessageQuotaService({
    organizationId: tenant.id,
    ip: await readVisitorIp(),
  })
  if (!quota.allowed) {
    return {status: 'rate_limited', limit: quota.limit}
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
