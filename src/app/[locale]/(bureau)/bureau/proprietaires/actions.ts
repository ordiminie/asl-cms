'use server'

import {revalidatePath} from 'next/cache'
import {redirect} from 'next/navigation'
import {getTranslations} from 'next-intl/server'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {
  ATTACH_PARCEL_FORM_FIELDS,
  type AttachParcelActionResult,
  type AttachParcelFormField,
  type ChangeMemberRoleActionResult,
  createAttachParcelFormSchema,
  createMemberContactFormSchema,
  createMemberProfileFormSchema,
  MEMBER_CONTACT_FORM_FIELDS,
  MEMBER_PROFILE_FORM_FIELDS,
  type MemberProfileActionResult,
  type MemberProfileFormField,
} from '@/components/features/member-profile/member-profile-form-validation'
import {MEMBER_PROFILES_ROUTE_PATTERN} from '@/components/features/member-profile/member-profile-paths'
import {
  type BuyerOption,
  createSaleFormSchema,
  type RecordSaleActionResult,
  SALE_FORM_FIELDS,
  type SaleFormField,
} from '@/components/features/member-profile/sale-form-validation'
import {frenchDateToIso} from '@/components/ui/date-field-format'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {
  createMemberProfileService,
  getMemberProfilePageService,
  getMemberProfileService,
  updateMemberProfileContactService,
} from '@/services/facades/member-profile-service-facade'
import {changeMemberRoleService} from '@/services/facades/member-role-service-facade'
import {
  attachParcelService,
  recordSaleService,
} from '@/services/facades/parcel-ownership-service-facade'
import type {MemberProfileWriteResult} from '@/services/types/domain/member-profile-types'
import type {MemberRoleChangeResult} from '@/services/types/domain/member-role-types'

/**
 * Server Actions des proprietaires et de leurs parcelles (s12, ecrans 2 a 5).
 *
 * Chacune rejoue le controle de session (`requireActionAuth`) avant d'appeler
 * la facade — le service reverifie `member.profile.manage` — puis revalide le
 * segment (liste et fiches) **apres** le succes seulement. Email deja pris et
 * chevauchement sont rendus comme des resultats, jamais leves.
 */

type Translator = Awaited<ReturnType<typeof getTranslations>>

const readField = (formData: FormData, key: string): string =>
  formData.get(key)?.toString() ?? ''

const readFields = <Field extends string>(
  formData: FormData,
  fields: readonly Field[]
): Record<Field, string> =>
  Object.fromEntries(
    fields.map((field) => [field, readField(formData, field)])
  ) as Record<Field, string>

const revalidateMemberProfileScreens = () => {
  revalidatePath(MEMBER_PROFILES_ROUTE_PATTERN, 'layout')
}

const toFailure = (
  error: unknown,
  t: Translator
): {status: 'error'; message: string} => ({
  status: 'error',
  message:
    error instanceof AuthorizationError
      ? t('errors.forbidden')
      : t('errors.failed'),
})

const toFieldErrors = <Field extends string>(
  issues: readonly {path: PropertyKey[]; message: string}[]
): {field: Field; message: string}[] =>
  issues.map((issue) => ({
    field: issue.path[0] as Field,
    message: issue.message,
  }))

/**
 * Traduit le resultat d'ecriture du service. Pour un email deja pris, lit le
 * nom de la fiche qui le porte : l'ecran y renvoie (etat `2e`). Le refus de
 * vider l'adresse d'un membre du bureau n'a rien ecrit : rien n'est revalide.
 * Un enregistrement porte le changement d'acces, pour le message (s12d).
 */
const toActionResult = async (
  organizationId: string,
  result: MemberProfileWriteResult,
  t: Translator
): Promise<MemberProfileActionResult> => {
  if (result.status === 'not_found') {
    return {status: 'error', message: t('errors.notFound')}
  }
  if (result.status === 'email_taken') {
    const holder = await getMemberProfileService(
      organizationId,
      result.memberProfileId
    )
    return {
      status: 'email_taken',
      memberProfileId: result.memberProfileId,
      name: holder?.name ?? '',
    }
  }

  if (result.status === 'board_email_required') {
    return {status: 'board_email_required'}
  }

  revalidateMemberProfileScreens()
  return {
    status: 'saved',
    memberProfileId: result.profile.id,
    accountChange: result.accountChange,
  }
}

/** « Enregistrer le proprietaire » (ecran 2). Avec un email, un compte (s12d). */
export async function createMemberProfileAction(
  _prevState: MemberProfileActionResult | undefined,
  formData: FormData
): Promise<MemberProfileActionResult> {
  const tenant = await requireCurrentTenantDal()
  const t = await getTranslations('BureauMemberProfilesPage')

  try {
    await requireActionAuth()

    const validation = createMemberProfileFormSchema(t).safeParse(
      readFields(formData, MEMBER_PROFILE_FORM_FIELDS)
    )
    if (!validation.success) {
      return {
        status: 'invalid',
        errors: toFieldErrors<MemberProfileFormField>(validation.error.issues),
      }
    }

    const result = await createMemberProfileService({
      organizationId: tenant.id,
      ...validation.data,
    })
    return await toActionResult(tenant.id, result, t)
  } catch (error) {
    return toFailure(error, t)
  }
}

/** « Enregistrer les coordonnees » depuis la fiche (ecran 3, etat `3e`). */
export async function updateMemberProfileContactAction(
  _prevState: MemberProfileActionResult | undefined,
  formData: FormData
): Promise<MemberProfileActionResult> {
  const tenant = await requireCurrentTenantDal()
  const t = await getTranslations('BureauMemberProfilesPage')

  try {
    await requireActionAuth()

    const validation = createMemberContactFormSchema(t).safeParse(
      readFields(formData, MEMBER_CONTACT_FORM_FIELDS)
    )
    if (!validation.success) {
      return {
        status: 'invalid',
        errors: toFieldErrors<MemberProfileFormField>(validation.error.issues),
      }
    }

    const result = await updateMemberProfileContactService({
      organizationId: tenant.id,
      memberProfileId: readField(formData, 'memberProfileId'),
      ...validation.data,
    })
    return await toActionResult(tenant.id, result, t)
  } catch (error) {
    return toFailure(error, t)
  }
}

/**
 * « Rattacher la parcelle » (ecran 4). Le chevauchement est rendu avec le
 * proprietaire en place et sa date (critere 4), la date future telle quelle ;
 * rien n'est alors ecrit.
 */
export async function attachParcelAction(
  _prevState: AttachParcelActionResult | undefined,
  formData: FormData
): Promise<AttachParcelActionResult> {
  const tenant = await requireCurrentTenantDal()
  const t = await getTranslations('BureauMemberProfilesPage')

  try {
    await requireActionAuth()

    const validation = createAttachParcelFormSchema(t).safeParse(
      readFields(formData, ATTACH_PARCEL_FORM_FIELDS)
    )
    const startsOn = validation.success
      ? frenchDateToIso(validation.data.startsOn)
      : undefined
    if (!validation.success || !startsOn) {
      return {
        status: 'invalid',
        errors: toFieldErrors<AttachParcelFormField>(
          validation.error?.issues ?? []
        ),
      }
    }

    const result = await attachParcelService({
      organizationId: tenant.id,
      memberProfileId: readField(formData, 'memberProfileId'),
      parcelNumber: validation.data.parcelNumber,
      startsOn,
    })
    if (result.status === 'member_not_found') {
      return {status: 'error', message: t('errors.notFound')}
    }
    if (result.status === 'overlap' || result.status === 'future_date') {
      return result
    }

    revalidateMemberProfileScreens()
    return {
      status: 'attached',
      parcelNumber: result.parcelNumber,
      parcelCreated: result.parcelCreated,
      startsOn,
    }
  } catch (error) {
    return toFailure(error, t)
  }
}

/**
 * « Enregistrer la vente » (ecran 5). Les refus du service — date anterieure
 * au debut de la periode, date future, acquereur = vendeur, chevauchement —
 * sont rendus
 * tels quels : rien n'a ete ecrit, rien n'est revalide.
 */
export async function recordSaleAction(
  _prevState: RecordSaleActionResult | undefined,
  formData: FormData
): Promise<RecordSaleActionResult> {
  const tenant = await requireCurrentTenantDal()
  const t = await getTranslations('BureauMemberProfilesPage')

  try {
    await requireActionAuth()

    const validation = createSaleFormSchema(t).safeParse(
      readFields(formData, SALE_FORM_FIELDS)
    )
    const date = validation.success
      ? frenchDateToIso(validation.data.date)
      : undefined
    if (!validation.success || !date) {
      return {
        status: 'invalid',
        errors: toFieldErrors<SaleFormField>(validation.error?.issues ?? []),
      }
    }

    const result = await recordSaleService({
      organizationId: tenant.id,
      parcelId: readField(formData, 'parcelId'),
      sellerId: readField(formData, 'sellerId'),
      buyerId: validation.data.buyerId,
      date,
    })
    if (result.status === 'not_found') {
      return {status: 'error', message: t('errors.notFound')}
    }
    if (result.status !== 'recorded') return result

    revalidateMemberProfileScreens()
    return result
  } catch (error) {
    return toFailure(error, t)
  }
}

/**
 * Recherche de l'acquereur (ecran 5) : les fiches de l'association dont le nom
 * ou une parcelle actuelle repond a la saisie. Sans session ou hors du
 * bureau, rien ne sort ; une panne remonte, pour que l'ecran la dise.
 */
export async function searchBuyersAction(
  query: string
): Promise<BuyerOption[]> {
  const search = query.trim()
  if (!search) return []

  try {
    const tenant = await requireCurrentTenantDal()
    await requireActionAuth()

    const page = await getMemberProfilePageService({
      organizationId: tenant.id,
      page: 1,
      search,
    })
    return page.items.map((item) => ({
      id: item.id,
      name: item.name,
      currentParcelNumbers: item.currentParcelNumbers,
    }))
  } catch (error) {
    if (error instanceof AuthorizationError) return []
    throw error
  }
}

/** Destination d'une propre retrogradation (A12) : l'espace personnel. */
const ROLE_WITHDRAWN_PATH = '/dashboard?role=retire'

/** Traduit le resultat du changement de role pour la carte (s14). */
const toRoleActionResult = (
  result: MemberRoleChangeResult,
  t: Translator
): ChangeMemberRoleActionResult => {
  if (result.status === 'not_found') {
    return {status: 'error', message: t('errors.notFound')}
  }
  if (result.status === 'no_account') {
    return {status: 'refused', message: t('detail.role.refusals.no_account')}
  }
  if (result.status === 'refused') {
    const key =
      result.reason === 'last_capable' && result.self
        ? 'last_capable_self'
        : result.reason
    return {
      status: 'refused',
      message: t(`detail.role.refusals.${key}`, {name: result.name}),
    }
  }
  if (result.change === 'none') {
    return {status: 'saved', change: 'none', message: null}
  }
  return {
    status: 'saved',
    change: result.change,
    message: t(`detail.role.saved.${result.change}`, {name: result.name}),
  }
}

/**
 * « Enregistrer le role » depuis la fiche (s14, ecran A). Le service relit la
 * fiche sous le tenant et decide ; le compte vise n'est jamais lu du
 * formulaire. Sa propre retrogradation renvoie vers l'espace personnel : le
 * back-office lui est ferme des la requete suivante.
 */
export async function changeMemberRoleAction(
  _prevState: ChangeMemberRoleActionResult | undefined,
  formData: FormData
): Promise<ChangeMemberRoleActionResult> {
  const tenant = await requireCurrentTenantDal()
  const t = await getTranslations('BureauMemberProfilesPage')

  let result: MemberRoleChangeResult
  try {
    await requireActionAuth()

    result = await changeMemberRoleService({
      organizationId: tenant.id,
      memberProfileId: readField(formData, 'memberProfileId'),
      role: readField(formData, 'role'),
    })
  } catch (error) {
    return toFailure(error, t)
  }

  if (result.status === 'saved' && result.change !== 'none') {
    revalidateMemberProfileScreens()
    if (result.self && result.change === 'demoted') {
      redirect(ROLE_WITHDRAWN_PATH)
    }
  }
  return toRoleActionResult(result, t)
}
