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
  PublicSiteAlertDTO,
  SITE_ALERT_ACTIVE_SETTING_KEY,
  SITE_ALERT_MESSAGE_SETTING_KEY,
  SiteAlertDTO,
} from './types/domain/site-alert-types'
import {User} from './types/domain/user-types'
import {
  saveSiteAlertServiceSchema,
  siteAlertOrganizationIdSchema,
} from './validation/site-alert-validation'

const MANAGE_DENIED =
  "Seul le bureau de l'association peut gérer le bandeau d'alerte"

const requireSiteAlertManager = async (
  organizationId: string
): Promise<User | undefined> => {
  const authUser = await getAuthUser()
  if (
    !canPerformAction(authUser, organizationId, ActionIdConst.SITE_ALERT_MANAGE)
  ) {
    throw new AuthorizationError(MANAGE_DENIED)
  }
  return authUser
}

/**
 * Lit les deux lignes du bandeau dans `organization_setting`, **hors du
 * registre typé** (ADR 021). Sans ligne : message vide, bandeau masque.
 *
 * A appeler dans un `withTenant(organizationId, ...)` ouvert par l'appelant.
 */
const readSiteAlert = async (organizationId: string): Promise<SiteAlertDTO> => {
  const rows = await getOrganizationSettingsDao(organizationId)
  const valueOf = (key: string) => rows.find((row) => row.key === key)?.value

  return {
    message: valueOf(SITE_ALERT_MESSAGE_SETTING_KEY) ?? '',
    active: valueOf(SITE_ALERT_ACTIVE_SETTING_KEY) === 'true',
  }
}

/** Le bandeau tel que l'ecran du bureau l'edite, message conserve compris. */
export const getSiteAlertService = async (
  organizationId: string
): Promise<SiteAlertDTO> => {
  const parsed = siteAlertOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requireSiteAlertManager(parsed.data)

  return withTenant(parsed.data, () => readSiteAlert(parsed.data))
}

/**
 * Enregistre le bandeau : message **et** etat dans une seule transaction —
 * jamais un message sans son etat, ni l'inverse. Retirer le bandeau n'efface
 * pas le message : seul l'etat passe a `'false'`.
 *
 * Ordre : `safeParse` -> controle d'acces -> ecriture sous le scope de
 * l'association.
 */
export const saveSiteAlertService = async (input: {
  organizationId: string
  message: string
  active: boolean
}): Promise<void> => {
  const parsed = saveSiteAlertServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const authUser = await requireSiteAlertManager(parsed.data.organizationId)

  await withTenant(parsed.data.organizationId, () =>
    saveOrganizationSettingsTxnDao({
      organizationId: parsed.data.organizationId,
      upserts: [
        {key: SITE_ALERT_MESSAGE_SETTING_KEY, value: parsed.data.message},
        {key: SITE_ALERT_ACTIVE_SETTING_KEY, value: String(parsed.data.active)},
      ],
      deletions: [],
      updatedBy: authUser?.id ?? null,
    })
  )
}

/**
 * Le bandeau tel que le visiteur le voit, ou `null` s'il n'est pas affiche :
 * un message masque ne sort pas du serveur.
 *
 * **Sans controle d'autorisation, et c'est delibere**, comme
 * `getPublicSiteNavigationService` : le bandeau s'adresse a tout le monde.
 */
export const getPublicSiteAlertService = async (
  organizationId: string
): Promise<PublicSiteAlertDTO | null> => {
  const parsed = siteAlertOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) return null

  const alert = await withTenant(parsed.data, () => readSiteAlert(parsed.data))
  if (!alert.active || alert.message.trim() === '') return null

  return {message: alert.message}
}

/**
 * L'utilisateur connecte peut-il gerer le bandeau de cette association ? Sert
 * l'interface ; chaque mutation reverifie de son cote.
 */
export const canManageSiteAlertService = async (
  organizationId: string
): Promise<boolean> => {
  const parsed = siteAlertOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) return false

  const authUser = await getAuthUser()
  return canPerformAction(
    authUser,
    parsed.data,
    ActionIdConst.SITE_ALERT_MANAGE
  )
}
