import 'server-only'

import {
  getOrganizationSettingsDao,
  saveOrganizationSettingsTxnDao,
} from '@/db/repositories/organization-setting-repository'
import {withTenant} from '@/db/tenant-scope'

import {getActingContext, getAuthUser} from './authentication/auth-service'
import {canPerformAction} from './authorization/action-registry-authorization'
import {AuthorizationError} from './errors/authorization-error'
import {ValidationParsedZodError} from './errors/validation-error'
import {findUnknownVariables} from './rules/campaign-rules'
import {
  findStatusesInBothLists,
  getInvoiceStatusClassification,
} from './rules/member-invoice-rules'
import {ActionIdConst} from './types/domain/action-registry-types'
import {
  ASSOCIATION_SETTINGS_REGISTRY,
  AssociationSettingError,
  AssociationSettingRow,
  BILLING_REMINDER_BODY_SETTING_KEY,
  BILLING_REMINDER_SUBJECT_SETTING_KEY,
  BILLING_SETTLED_STATUSES_SETTING_KEY,
  BILLING_UNPAID_STATUSES_SETTING_KEY,
  isSuperAdminOnlySetting,
  ResolvedAssociationSettings,
  resolveSettings,
  validateSettingsChanges,
} from './types/domain/association-settings-types'
import {RoleConst} from './types/domain/auth-types'
import {UNPAID_REMINDER_INVOICES_VARIABLE} from './types/domain/campaign-types'
import {
  associationSettingsOrganizationIdSchema,
  updateAssociationSettingsServiceSchema,
} from './validation/association-settings-validation'

export type AssociationSettingsUpdate =
  | {status: 'saved'}
  | {status: 'rejected'; errors: Record<string, AssociationSettingError>}

/**
 * Lit les parametres d'une association, defauts du registre appliques.
 *
 * **Sans controle d'autorisation, et c'est delibere**, comme
 * `readAssociationIdentityFileService` : la teinte sert le site public, et les
 * adresses sont lues cote serveur sans session (s08, s10). Appelee par le DAL
 * et des chemins serveur seulement ; les adresses ne s'affichent que dans la
 * page « Reglages », elle-meme gardee.
 */
export const getAssociationSettingsService = async (
  organizationId: string
): Promise<ResolvedAssociationSettings> => {
  const parsed =
    associationSettingsOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const rows = await withTenant(parsed.data, () =>
    getOrganizationSettingsDao(parsed.data)
  )
  return resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, rows)
}

/**
 * Modifie des parametres d'une association (s02). Ordre : `safeParse` ->
 * controle d'acces -> validation du registre (tout ou rien) -> ecriture sous le
 * scope de l'association. Une valeur refusee est rendue comme un resultat,
 * sans rien ecrire.
 */
export const updateAssociationSettingsService = async (
  organizationId: string,
  changes: Record<string, string>
): Promise<AssociationSettingsUpdate> => {
  const parsed = updateAssociationSettingsServiceSchema.safeParse({
    organizationId,
    changes,
  })
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const authUser = await getAuthUser()
  if (
    !canPerformAction(
      authUser,
      parsed.data.organizationId,
      ActionIdConst.ASSOCIATION_SETTINGS_UPDATE
    )
  ) {
    throw new AuthorizationError(
      "Seul le bureau de l'association peut modifier ses réglages"
    )
  }

  if (
    touchesSuperAdminOnlySetting(parsed.data.changes) &&
    !(await canEditSuperAdminOnlySettingsService())
  ) {
    throw new AuthorizationError(
      "Seul le SuperAdmin peut modifier la limite d'envoi et la réserve de connexion"
    )
  }

  const tenantId = parsed.data.organizationId
  return withTenant(tenantId, async () => {
    const stored = await getOrganizationSettingsDao(tenantId)
    const validation = validateSettingsChanges(
      ASSOCIATION_SETTINGS_REGISTRY,
      parsed.data.changes,
      stored
    )
    if (!validation.valid) {
      return {status: 'rejected', errors: validation.errors}
    }
    const statusErrors = invoiceStatusListsErrors(
      parsed.data.changes,
      validation.upserts,
      stored
    )
    if (Object.keys(statusErrors).length > 0) {
      return {status: 'rejected', errors: statusErrors}
    }
    const variableErrors = reminderVariablesErrors(validation.upserts)
    if (Object.keys(variableErrors).length > 0) {
      return {status: 'rejected', errors: variableErrors}
    }

    await saveOrganizationSettingsTxnDao({
      organizationId: tenantId,
      upserts: validation.upserts,
      deletions: validation.deletions,
      updatedBy: authUser?.id ?? null,
    })
    return {status: 'saved'}
  })
}

const touchesSuperAdminOnlySetting = (
  changes: Record<string, string>
): boolean =>
  ASSOCIATION_SETTINGS_REGISTRY.some(
    (definition) =>
      isSuperAdminOnlySetting(definition) && definition.key in changes
  )

/**
 * Le SuperAdmin agit (s52, ADR 053) : connecte sous son propre compte, ou
 * pendant une session ouverte a la place d'un compte (s48 : seul un
 * SuperAdmin peut l'ouvrir). Seul lui modifie les reglages `editableBy:
 * 'super_admin'` ; la page « Reglages » les montre en lecture seule sinon.
 */
export const canEditSuperAdminOnlySettingsService =
  async (): Promise<boolean> => {
    const acting = await getActingContext()
    if (!acting) return false
    return (
      acting.user.role === RoleConst.SUPER_ADMIN ||
      acting.impersonator !== undefined
    )
  }

const INVOICE_STATUS_LIST_KEYS = [
  BILLING_UNPAID_STATUSES_SETTING_KEY,
  BILLING_SETTLED_STATUSES_SETTING_KEY,
] as const

/**
 * Controle croise des deux listes de statuts de facture (s19, ADR 059 §4) :
 * apres le lot, un statut ne peut pas etre a la fois « impaye » et « regle ».
 * Le refus porte sur la ou les listes modifiees par le lot.
 */
const invoiceStatusListsErrors = (
  changes: Record<string, string>,
  upserts: readonly AssociationSettingRow[],
  stored: readonly AssociationSettingRow[]
): Record<string, AssociationSettingError> => {
  const touched = INVOICE_STATUS_LIST_KEYS.filter((key) => key in changes)
  if (touched.length === 0) return {}
  const after = resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
    ...stored.filter(({key}) => !(key in changes)),
    ...upserts,
  ])
  if (findStatusesInBothLists(getInvoiceStatusClassification(after)).length) {
    return Object.fromEntries(
      touched.map((key) => [key, {code: 'statusInBothLists'} as const])
    )
  }
  return {}
}

/**
 * Les variables reconnues par l'objet et le texte de la relance automatique
 * (s29, ADR 070 §9) : celles des campagnes, plus `{factures}` dans le texte
 * seul. Une relance part sans relecture du bureau : une variable inconnue est
 * refusee a l'enregistrement.
 */
const REMINDER_ALLOWED_VARIABLES: Record<string, readonly string[]> = {
  [BILLING_REMINDER_SUBJECT_SETTING_KEY]: [],
  [BILLING_REMINDER_BODY_SETTING_KEY]: [UNPAID_REMINDER_INVOICES_VARIABLE],
}

const reminderVariablesErrors = (
  upserts: readonly AssociationSettingRow[]
): Record<string, AssociationSettingError> =>
  Object.fromEntries(
    upserts
      .filter(
        ({key, value}) =>
          key in REMINDER_ALLOWED_VARIABLES &&
          findUnknownVariables(value, REMINDER_ALLOWED_VARIABLES[key]).length >
            0
      )
      .map(({key}) => [key, {code: 'unknownVariable'} as const])
  )
