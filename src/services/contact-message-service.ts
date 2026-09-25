import 'server-only'

import {ContactMessageModel} from '@/db/models/contact-message-model'
import {
  countUnreadContactMessagesDao,
  createContactMessageDao,
  getContactMessageByIdDao,
  getContactMessagesPageDao,
  markContactMessageNotificationFailedDao,
  setContactMessageReadDao,
} from '@/db/repositories/contact-message-repository'
import {getOrganizationByIdDao} from '@/db/repositories/organization-repository'
import {withTenant} from '@/db/tenant-scope'
import {associationOriginOf} from '@/lib/better-auth/association-origin'
import {resolveSupportedLocale} from '@/lib/helper/locale-helper'
import {logger} from '@/lib/logger'

import {getAssociationSettingsService} from './association-settings-service'
import {getAuthUser} from './authentication/auth-service'
import {canPerformAction} from './authorization/action-registry-authorization'
import {sendContactMessageNotificationEmailService} from './email-service'
import {AuthorizationError} from './errors/authorization-error'
import {NotFoundError} from './errors/not-found-error'
import {ValidationParsedZodError} from './errors/validation-error'
import {ActionIdConst} from './types/domain/action-registry-types'
import {getIdentityVersionFromKey} from './types/domain/association-identity-types'
import {
  CONTACT_EMAIL_SETTING_KEY,
  getAccentHue,
} from './types/domain/association-settings-types'
import {
  CONTACT_MESSAGES_BUREAU_PAGE_SIZE,
  ContactMessageDTO,
  ContactMessageListPageDTO,
  ContactMessageSubmissionResult,
  countContactMessagePages,
  CreateContactMessageInput,
} from './types/domain/contact-message-types'
import {
  contactMessageOrganizationIdSchema,
  contactMessageServiceSchema,
  contactMessagesPageServiceSchema,
  createContactMessageServiceSchema,
  setContactMessageReadServiceSchema,
} from './validation/contact-message-validation'

const READ_DENIED =
  "Seul le bureau de l'association peut consulter les messages reçus"
const MESSAGE_NOT_FOUND = 'Message introuvable'

const toContactMessageDto = (row: ContactMessageModel): ContactMessageDTO => ({
  id: row.id,
  organizationId: row.organizationId,
  senderName: row.senderName,
  senderEmail: row.senderEmail,
  subject: row.subject,
  body: row.body,
  read: row.read,
  notificationFailed: row.notificationFailed,
  createdAt: row.createdAt,
})

const requireMessagesReader = async (organizationId: string): Promise<void> => {
  const authUser = await getAuthUser()
  if (
    !canPerformAction(
      authUser,
      organizationId,
      ActionIdConst.CONTACT_MESSAGE_READ
    )
  ) {
    throw new AuthorizationError(READ_DENIED)
  }
}

/** Logo PNG de l'association, servi par sa propre origine (comme s03). */
const pngLogoUrlOf = (
  logoKey: string | null | undefined,
  origin: string
): string | undefined => {
  const version = getIdentityVersionFromKey(logoKey)
  if (!version || !logoKey?.endsWith('.png')) return undefined
  return `${origin}/api/identity/logo?v=${encodeURIComponent(version)}`
}

/**
 * Envoie l'email d'avertissement au bureau. L'adresse est lue **a l'envoi**
 * dans les parametres de l'association (critere 4 : « le message suivant »),
 * jamais dans l'environnement. Toute impossibilite de notifier leve.
 */
const notifyBoard = async (
  message: ContactMessageModel,
  locale: string
): Promise<void> => {
  const [settings, organization] = await Promise.all([
    getAssociationSettingsService(message.organizationId),
    getOrganizationByIdDao(message.organizationId),
  ])
  const to = settings[CONTACT_EMAIL_SETTING_KEY]?.value
  const origin = associationOriginOf(organization?.domain)
  if (!to || !organization || !origin) {
    throw new Error(
      "Adresse de notification ou domaine de l'association absent"
    )
  }

  const logoUrl = pngLogoUrlOf(organization.identityLogoKey, origin)
  await sendContactMessageNotificationEmailService({
    to: String(to),
    locale: resolveSupportedLocale(locale),
    association: {
      name: organization.name,
      hue: getAccentHue(settings),
      ...(logoUrl ? {logoUrl} : {}),
    },
    messageUrl: `${origin}/bureau/messages/${message.id}`,
    message: toContactMessageDto(message),
  })
}

/**
 * Enregistre un message envoye depuis `/contact`, puis avertit le bureau.
 *
 * **Sans controle d'autorisation, et c'est delibere** : l'auteur est un
 * visiteur anonyme, comme pour `consumeMagicLinkRequestQuotaService`. Ordre :
 * validation -> ecriture -> notification. Une soumission invalide ne coute ni
 * ecriture ni email ; un echec de notification **ne fait pas echouer** la
 * soumission — le message est la, et le bureau voit l'echec dans sa liste.
 * Aucune adresse IP n'entre ici.
 */
export const createContactMessageService = async (
  input: CreateContactMessageInput
): Promise<ContactMessageSubmissionResult> => {
  const parsed = createContactMessageServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const {organizationId, locale, name, email, subject, body} = parsed.data
  const created = await withTenant(organizationId, () =>
    createContactMessageDao({
      organizationId,
      senderName: name,
      senderEmail: email,
      subject,
      body,
    })
  )

  try {
    await notifyBoard(created, locale)
    return {status: 'created', id: created.id, notificationFailed: false}
  } catch (error) {
    logger.error('[CONTACT-MESSAGE] Notification au bureau non envoyee', {
      messageId: created.id,
      error: error instanceof Error ? error.message : String(error),
    })
    await flagNotificationFailed(organizationId, created.id)
    return {status: 'created', id: created.id, notificationFailed: true}
  }
}

/**
 * Pose le temoin d'echec. S'il ne se pose pas, le message reste enregistre :
 * l'echec est journalise, la soumission n'echoue pas pour autant.
 */
const flagNotificationFailed = async (
  organizationId: string,
  messageId: string
): Promise<void> => {
  try {
    await withTenant(organizationId, () =>
      markContactMessageNotificationFailedDao(messageId)
    )
  } catch (error) {
    logger.error("[CONTACT-MESSAGE] Temoin d'echec de notification non pose", {
      messageId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/** Une page de la liste du bureau, la plus recente d'abord. */
export const getContactMessagesPageService = async (
  organizationId: string,
  page: number
): Promise<ContactMessageListPageDTO> => {
  const parsed = contactMessagesPageServiceSchema.safeParse({
    organizationId,
    page,
  })
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requireMessagesReader(parsed.data.organizationId)

  const {organizationId: orgId} = parsed.data
  const pageSize = CONTACT_MESSAGES_BUREAU_PAGE_SIZE
  const readPage = (page: number) =>
    getContactMessagesPageDao({
      organizationId: orgId,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    })

  return withTenant(orgId, async () => {
    const [requested, unreadCount] = await Promise.all([
      readPage(parsed.data.page),
      countUnreadContactMessagesDao(orgId),
    ])
    const totalPages = countContactMessagePages(requested.total, pageSize)
    const page = Math.min(parsed.data.page, totalPages)
    const result = page === parsed.data.page ? requested : await readPage(page)

    return {
      items: result.rows.map((row) => toContactMessageDto(row)),
      page,
      pageSize,
      total: result.total,
      totalPages: countContactMessagePages(result.total, pageSize),
      unreadCount,
    }
  })
}

/** Un message du bureau, par son identifiant. */
export const getContactMessageService = async (
  organizationId: string,
  messageId: string
): Promise<ContactMessageDTO> => {
  const parsed = contactMessageServiceSchema.safeParse({
    organizationId,
    messageId,
  })
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requireMessagesReader(parsed.data.organizationId)

  const row = await withTenant(parsed.data.organizationId, () =>
    getContactMessageByIdDao(parsed.data.messageId)
  )
  if (!row || row.organizationId !== parsed.data.organizationId) {
    throw new NotFoundError(MESSAGE_NOT_FOUND)
  }
  return toContactMessageDto(row)
}

/** Bascule le temoin lu / non lu. Idempotent. */
export const setContactMessageReadService = async (input: {
  organizationId: string
  messageId: string
  read: boolean
}): Promise<ContactMessageDTO> => {
  const parsed = setContactMessageReadServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requireMessagesReader(parsed.data.organizationId)

  const row = await withTenant(parsed.data.organizationId, () =>
    setContactMessageReadDao(parsed.data.messageId, parsed.data.read)
  )
  if (!row) {
    throw new NotFoundError(MESSAGE_NOT_FOUND)
  }
  return toContactMessageDto(row)
}

/** L'utilisateur connecte peut-il consulter les messages de cette association ? */
export const canManageContactMessagesService = async (
  organizationId: string
): Promise<boolean> => {
  const parsed = contactMessageOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) return false

  const authUser = await getAuthUser()
  return canPerformAction(
    authUser,
    parsed.data,
    ActionIdConst.CONTACT_MESSAGE_READ
  )
}
