import 'server-only'

import {AssociationCategoryModel} from '@/db/models/association-category-model'
import {MemberQuestionModel} from '@/db/models/member-question-model'
import {listActiveCategoriesDao} from '@/db/repositories/association-category-repository'
import {getMemberProfilesByUserIdDao} from '@/db/repositories/member-profile-repository'
import {
  createMemberQuestionDao,
  getMemberQuestionByIdDao,
  getMemberQuestionsPageDao,
  markMemberQuestionNotificationFailedDao,
  MemberQuestionRow,
} from '@/db/repositories/member-question-repository'
import {getOrganizationByIdDao} from '@/db/repositories/organization-repository'
import {withTenant} from '@/db/tenant-scope'
import {associationOriginOf} from '@/lib/better-auth/association-origin'
import {pngLogoUrlOf} from '@/lib/emails/logo-url'
import {resolveSupportedLocale} from '@/lib/helper/locale-helper'
import {logger} from '@/lib/logger'

import {getAssociationSettingsService} from './association-settings-service'
import {getAuthUser} from './authentication/auth-service'
import {canPerformAction} from './authorization/action-registry-authorization'
import {sendMemberQuestionNotificationEmailService} from './email-service'
import {AuthorizationError} from './errors/authorization-error'
import {NotFoundError} from './errors/not-found-error'
import {
  ValidationError,
  ValidationParsedZodError,
} from './errors/validation-error'
import {orderMyProfiles} from './rules/my-profiles-order-rules'
import {ActionIdConst} from './types/domain/action-registry-types'
import {
  CategoryDomainConst,
  PublicCategoryDTO,
} from './types/domain/association-category-types'
import {
  CONTACT_EMAIL_SETTING_KEY,
  getAccentHue,
} from './types/domain/association-settings-types'
import {
  countMemberQuestionPages,
  CreateMyQuestionInput,
  MEMBER_QUESTIONS_BUREAU_PAGE_SIZE,
  MemberQuestionDTO,
  MemberQuestionListPageDTO,
  MyQuestionIdentityDTO,
  MyQuestionSubmissionResult,
  resolveQuestionRecipient,
} from './types/domain/member-question-types'
import {
  createMyQuestionServiceSchema,
  memberQuestionOrganizationIdSchema,
  memberQuestionServiceSchema,
  memberQuestionsPageServiceSchema,
} from './validation/member-question-validation'

const MANAGE_DENIED =
  "Seul le bureau de l'association peut consulter les questions des membres"
const MEMBER_QUESTION_DENIED =
  'Connectez-vous pour poser une question au bureau'
const QUESTION_NOT_FOUND = 'Question introuvable'
const CATEGORY_NOT_OFFERED =
  "Le sujet choisi n'est pas proposé par l'association"

type MemberProfileIdentity = {id: string; name: string; email: string | null}

const toQuestionDto = (row: MemberQuestionRow): MemberQuestionDTO => ({
  id: row.id,
  memberId: row.memberId,
  memberName: row.memberName,
  memberEmail: row.memberEmail,
  categoryName: row.categoryName,
  categoryDeleted: row.categoryDeletedAt !== null,
  body: row.body,
  notificationFailed: row.notificationFailed,
  createdAt: row.createdAt,
})

const requireQuestionsManager = async (organizationId: string) => {
  const authUser = await getAuthUser()
  if (
    !authUser ||
    !canPerformAction(authUser, organizationId, ActionIdConst.QUESTION_MANAGE)
  ) {
    throw new AuthorizationError(MANAGE_DENIED)
  }
}

const requireSessionUser = async () => {
  const authUser = await getAuthUser()
  if (!authUser) {
    throw new AuthorizationError(MEMBER_QUESTION_DENIED)
  }
  return authUser
}

/**
 * Le sujet choisi, **actif et du domaine `question`**, lu dans le scope du
 * tenant : un identifiant supprime ou d'une autre association n'y est pas
 * visible, donc refuse (D2).
 */
const resolveQuestionCategory = async (
  organizationId: string,
  categoryId: string
): Promise<AssociationCategoryModel> => {
  const offered = await listActiveCategoriesDao(
    organizationId,
    CategoryDomainConst.QUESTION
  )
  const category = offered.find((candidate) => candidate.id === categoryId)
  if (!category) throw new ValidationError(CATEGORY_NOT_OFFERED)
  return category
}

/**
 * Avertit le bureau (D1) : **un seul envoi**, vers l'adresse du sujet, sinon
 * vers l'adresse de contact lue a l'envoi dans les Reglages. Un report par le
 * budget d'envoi (s52) n'est pas un echec. Rien ne peut partir : la fonction
 * leve.
 */
const notifyBoard = async (
  question: MemberQuestionModel,
  category: AssociationCategoryModel,
  profile: MemberProfileIdentity,
  locale: string
): Promise<void> => {
  const [settings, organization] = await Promise.all([
    getAssociationSettingsService(question.organizationId),
    getOrganizationByIdDao(question.organizationId),
  ])
  const contactEmail = settings[CONTACT_EMAIL_SETTING_KEY]?.value
  const to = resolveQuestionRecipient(
    category.routingEmail,
    contactEmail ? String(contactEmail) : undefined
  )
  const origin = associationOriginOf(organization?.domain)
  if (!to || !organization || !origin) {
    throw new Error(
      "Adresse de notification ou domaine de l'association absent"
    )
  }

  const logoUrl = pngLogoUrlOf(organization.identityLogoKey, origin)
  await sendMemberQuestionNotificationEmailService({
    organizationId: question.organizationId,
    questionId: question.id,
    to,
    locale: resolveSupportedLocale(locale),
    association: {
      name: organization.name,
      hue: getAccentHue(settings),
      ...(logoUrl ? {logoUrl} : {}),
    },
    questionUrl: `${origin}/bureau/questions/${question.id}`,
    question: {
      categoryName: category.name,
      memberName: profile.name,
      memberEmail: profile.email,
      body: question.body,
      createdAt: question.createdAt,
    },
  })
}

/**
 * Pose le temoin d'echec. S'il ne se pose pas, la question reste enregistree :
 * l'echec est journalise, sans rien de la question.
 */
const flagNotificationFailed = async (
  organizationId: string,
  questionId: string
): Promise<void> => {
  try {
    await withTenant(organizationId, () =>
      markMemberQuestionNotificationFailedDao(questionId)
    )
  } catch (error) {
    logger.error("[MEMBER-QUESTION] Temoin d'echec de notification non pose", {
      questionId,
      error: error instanceof Error ? error.name : 'unknown',
    })
  }
}

const notifyBoardOfNewQuestion = async (
  question: MemberQuestionModel,
  category: AssociationCategoryModel,
  profile: MemberProfileIdentity,
  locale: string
): Promise<MyQuestionSubmissionResult> => {
  try {
    await notifyBoard(question, category, profile, locale)
    return {status: 'created', id: question.id, notificationFailed: false}
  } catch (error) {
    logger.error('[MEMBER-QUESTION] Notification au bureau non envoyee', {
      questionId: question.id,
      error: error instanceof Error ? error.name : 'unknown',
    })
    await flagNotificationFailed(question.organizationId, question.id)
    return {status: 'created', id: question.id, notificationFailed: true}
  }
}

/**
 * Un membre connecte pose une question au bureau depuis son espace (s23,
 * criteres 1 et 2). La fiche se resout par **la session et le domaine
 * appele** (ADR 049) : aucune identite ni `memberId` n'est lu de l'entree.
 * Ordre : validation -> fiche -> sujet actif du tenant -> ecriture ->
 * notification. Un echec de notification **ne fait pas echouer** la
 * soumission. Sans fiche dans l'association : `not_found`.
 */
export const createMyQuestionService = async (
  input: CreateMyQuestionInput
): Promise<MyQuestionSubmissionResult> => {
  const parsed = createMyQuestionServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const authUser = await requireSessionUser()
  const {organizationId, locale, categoryId, body} = parsed.data
  const written = await withTenant(organizationId, async () => {
    const [profile] = orderMyProfiles(
      await getMemberProfilesByUserIdDao(organizationId, authUser.id)
    )
    if (!profile) return undefined

    const category = await resolveQuestionCategory(organizationId, categoryId)
    const question = await createMemberQuestionDao({
      organizationId,
      memberId: profile.id,
      categoryId: category.id,
      body,
    })
    return {question, category, profile}
  })
  if (!written) return {status: 'not_found'}

  return notifyBoardOfNewQuestion(
    written.question,
    written.category,
    written.profile,
    locale
  )
}

/**
 * Lecture **cote membre** : aucun identifiant de fiche en entree. La fiche se
 * resout par la session et le domaine appele, sous `withTenant` : la premiere
 * du compte dans l'ordre de l'ADR 054 §7 (s53). Rien pour un compte sans
 * fiche.
 */
const readForMyProfile = async <T>(
  organizationId: string,
  read: (profile: MemberProfileIdentity) => Promise<T>
): Promise<T | undefined> => {
  const parsed = memberQuestionOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const authUser = await requireSessionUser()
  return withTenant(parsed.data, async () => {
    const [profile] = orderMyProfiles(
      await getMemberProfilesByUserIdDao(parsed.data, authUser.id)
    )
    return profile ? read(profile) : undefined
  })
}

/** Les sujets ouverts aux questions : identifiant et nom, jamais l'adresse. */
export const listMyQuestionCategoriesService = async (
  organizationId: string
): Promise<PublicCategoryDTO[] | undefined> =>
  readForMyProfile(organizationId, async () => {
    const rows = await listActiveCategoriesDao(
      organizationId,
      CategoryDomainConst.QUESTION
    )
    return rows.map((row) => ({id: row.id, name: row.name}))
  })

/** Ce que le bureau recevra du membre : le nom et l'email de sa fiche. */
export const getMyQuestionIdentityService = async (
  organizationId: string
): Promise<MyQuestionIdentityDTO | undefined> =>
  readForMyProfile(organizationId, async (profile) => ({
    name: profile.name,
    email: profile.email,
  }))

/** Une page de la file du bureau, la plus recente d'abord (critere 4). */
export const getMemberQuestionsPageService = async (
  organizationId: string,
  page: number
): Promise<MemberQuestionListPageDTO> => {
  const parsed = memberQuestionsPageServiceSchema.safeParse({
    organizationId,
    page,
  })
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const {organizationId: orgId} = parsed.data
  await requireQuestionsManager(orgId)

  const pageSize = MEMBER_QUESTIONS_BUREAU_PAGE_SIZE
  return withTenant(orgId, async () => {
    const [requested, categories] = await Promise.all([
      getMemberQuestionsPageDao(orgId, parsed.data.page, pageSize),
      listActiveCategoriesDao(orgId, CategoryDomainConst.QUESTION),
    ])
    const totalPages = countMemberQuestionPages(requested.total, pageSize)
    const current = Math.min(parsed.data.page, totalPages)
    const result =
      current === parsed.data.page
        ? requested
        : await getMemberQuestionsPageDao(orgId, current, pageSize)

    return {
      items: result.rows.map((row) => toQuestionDto(row)),
      page: current,
      pageSize,
      total: result.total,
      totalPages: countMemberQuestionPages(result.total, pageSize),
      hasOpenCategories: categories.length > 0,
    }
  })
}

/**
 * Une question du bureau, sujet supprime compris (critere 5). Une question
 * d'une autre association n'existe pas.
 */
export const getMemberQuestionService = async (
  organizationId: string,
  questionId: string
): Promise<MemberQuestionDTO> => {
  const parsed = memberQuestionServiceSchema.safeParse({
    organizationId,
    questionId,
  })
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requireQuestionsManager(parsed.data.organizationId)

  const row = await withTenant(parsed.data.organizationId, () =>
    getMemberQuestionByIdDao(parsed.data.questionId)
  )
  if (!row || row.organizationId !== parsed.data.organizationId) {
    throw new NotFoundError(QUESTION_NOT_FOUND)
  }
  return toQuestionDto(row)
}

/** L'utilisateur connecte peut-il consulter les questions de cette association ? */
export const canManageMemberQuestionsService = async (
  organizationId: string
): Promise<boolean> => {
  const parsed = memberQuestionOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) return false

  const authUser = await getAuthUser()
  return canPerformAction(authUser, parsed.data, ActionIdConst.QUESTION_MANAGE)
}
