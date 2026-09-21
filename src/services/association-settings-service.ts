import 'server-only'

import {
  getOrganizationSettingsDao,
  saveOrganizationSettingsTxnDao,
} from '@/db/repositories/organization-setting-repository'
import {withTenant} from '@/db/tenant-scope'

import {getAuthUser} from './authentication/auth-service'
import {canPerformAction} from './authorization/action-registry-authorization'
import {AuthorizationError} from './errors/authorization-error'
import {ValidationParsedZodError} from './errors/validation-error'
import {ActionIdConst} from './types/domain/action-registry-types'
import {
  ASSOCIATION_SETTINGS_REGISTRY,
  AssociationSettingError,
  ResolvedAssociationSettings,
  resolveSettings,
  validateSettingsChanges,
} from './types/domain/association-settings-types'
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

  const validation = validateSettingsChanges(
    ASSOCIATION_SETTINGS_REGISTRY,
    parsed.data.changes
  )
  if (!validation.valid) {
    return {status: 'rejected', errors: validation.errors}
  }

  await withTenant(parsed.data.organizationId, () =>
    saveOrganizationSettingsTxnDao({
      organizationId: parsed.data.organizationId,
      upserts: validation.upserts,
      deletions: validation.deletions,
      updatedBy: authUser?.id ?? null,
    })
  )

  return {status: 'saved'}
}
