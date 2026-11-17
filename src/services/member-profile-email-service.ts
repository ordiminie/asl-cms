import 'server-only'

import {
  deleteMemberProfileEmailDao,
  insertMemberProfileEmailDao,
  MemberProfileEmailRow,
  purgeExpiredPendingEmailsDao,
  setMemberProfileEmailRoleDao,
  updateMemberProfileEmailDao,
} from '@/db/repositories/member-profile-email-repository'
import {
  getLinkedAccountsDao,
  getMemberProfileByIdDao,
  LinkedAccountRow,
  MemberProfileReadRow,
} from '@/db/repositories/member-profile-repository'
import {withTenant} from '@/db/tenant-scope'

import {ValidationParsedZodError} from './errors/validation-error'
import {
  applyMemberAccountDecision,
  getLinkedAccountRole,
} from './member-account-service'
import {
  accountOfEmail,
  activatePendingEmail,
  authorOf,
  confirmedHolder,
  findEmailHolder,
  otherLinkedProfilesOf,
  readProfileEmails,
  readProfileView,
  requireMemberProfileManager,
} from './member-profile-support'
import {decideMemberAccount, sameEmail} from './rules/member-account-rules'
import {
  planEmailRemoval,
  planHolderDesignation,
  roleForNewActiveEmail,
} from './rules/member-email-rules'
import {MemberAccountAuthor} from './types/domain/member-account-types'
import {
  MemberEmailOriginConst,
  MemberEmailReplacement,
  MemberEmailRoleConst,
  MemberEmailStatusConst,
} from './types/domain/member-email-types'
import {
  AddMemberProfileEmailInput,
  DesignateMemberProfileHolderInput,
  MemberProfileEmailChange,
  MemberProfileEmailWriteResult,
  RemoveMemberProfileEmailInput,
  UpdateMemberProfileEmailInput,
} from './types/domain/member-profile-types'
import {User} from './types/domain/user-types'
import {
  addMemberProfileEmailServiceSchema,
  designateMemberProfileHolderServiceSchema,
  removeMemberProfileEmailServiceSchema,
  updateMemberProfileEmailServiceSchema,
} from './validation/member-profile-validation'

/**
 * Les adresses d'une fiche, ecrites par le bureau (s54, ADR 056 §4) : ajout
 * (active d'office, origine site), modification, retrait et designation de
 * la titulaire. Chaque fonction : validation, `member.profile.manage`,
 * auteur lu **avant** `withTenant` (s48), puis une seule transaction de
 * tenant ou la regle de succession (`member-email-rules`) decide avant toute
 * ecriture, et ou le compte de chaque adresse suit (`member-account-service`).
 * Les attentes echues sont purgees par l'ecriture.
 */

type EmailWriteContext = {
  authUser: User | undefined
  author: MemberAccountAuthor
  organizationId: string
  now: Date
}

type ProfileEmails = {
  profile: MemberProfileReadRow
  emails: MemberProfileEmailRow[]
  accounts: LinkedAccountRow[]
}

/** La fiche, ses adresses visibles et ses comptes, apres purge. */
const loadProfileEmails = async (
  context: EmailWriteContext,
  memberProfileId: string
): Promise<ProfileEmails | undefined> => {
  const profile = await getMemberProfileByIdDao(memberProfileId)
  if (!profile) return undefined
  await purgeExpiredPendingEmailsDao(context.organizationId, context.now)
  return {
    profile,
    emails: await readProfileEmails(memberProfileId, context.now),
    accounts: await getLinkedAccountsDao(memberProfileId),
  }
}

/** La fiche relue apres l'ecriture, pour l'ecran (4g). */
const savedResult = async (
  context: EmailWriteContext,
  memberProfileId: string,
  change: MemberProfileEmailChange,
  email: string
): Promise<MemberProfileEmailWriteResult> => {
  const row = await getMemberProfileByIdDao(memberProfileId)
  if (!row) return {status: 'not_found'}
  return {
    status: 'saved',
    profile: await readProfileView(
      context.authUser,
      context.organizationId,
      row,
      context.now
    ),
    change,
    email,
  }
}

const writeContext = async (
  organizationId: string
): Promise<EmailWriteContext> => {
  const authUser = await requireMemberProfileManager(organizationId)
  return {
    authUser,
    author: await authorOf(authUser),
    organizationId,
    now: new Date(),
  }
}

/**
 * Ouvre le compte d'une adresse devenue active : celui que le bureau a
 * confirme (adresse partagee, s53), sinon celui de l'adresse.
 */
const openEmailAccount = async (
  context: EmailWriteContext,
  profile: {id: string; name: string},
  email: string,
  confirmedUserId: string | null
): Promise<void> => {
  await applyMemberAccountDecision({
    organizationId: context.organizationId,
    author: context.author,
    profile: {id: profile.id, name: profile.name, email, userId: null},
    decision: confirmedUserId
      ? {kind: 'link_shared', userId: confirmedUserId}
      : {kind: 'open'},
  })
}

/**
 * Ajoute une adresse a une fiche : active d'office, supplementaire, ou
 * titulaire si la fiche n'en a aucune active ou si le bureau la choisit
 * (critere 8 : l'ancienne titulaire devient supplementaire). Une adresse
 * deja celle d'un compte de l'association n'est ecrite qu'apres
 * confirmation du bureau (s53, 4c).
 */
export const addMemberProfileEmailService = async (
  input: AddMemberProfileEmailInput
): Promise<MemberProfileEmailWriteResult> => {
  const parsed = addMemberProfileEmailServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const {organizationId, memberProfileId, email, role, origin} = parsed.data
  const context = await writeContext(organizationId)

  return withTenant(organizationId, async () => {
    const loaded = await loadProfileEmails(context, memberProfileId)
    if (!loaded) return {status: 'not_found'}
    if (loaded.emails.some((known) => sameEmail(known.email, email))) {
      return {status: 'already_listed'}
    }

    const holder = await findEmailHolder(organizationId, email, {
      memberProfileId,
      userIds: loaded.accounts.map((account) => account.userId),
    })
    const shared = confirmedHolder(holder, parsed.data.confirmedAccountUserId)
    if (shared.kind === 'ask' && holder) {
      return {status: 'email_shared', holder}
    }

    const plan = roleForNewActiveEmail(loaded.emails, role)
    if (plan.demoteEmailId) {
      await setMemberProfileEmailRoleDao(
        plan.demoteEmailId,
        MemberEmailRoleConst.ADDITIONAL
      )
    }
    await insertMemberProfileEmailDao({
      organizationId,
      memberProfileId,
      email,
      role: plan.role,
      status: MemberEmailStatusConst.ACTIVE,
      origin: origin ?? MemberEmailOriginConst.SITE,
    })
    await openEmailAccount(
      context,
      loaded.profile,
      email,
      shared.kind === 'confirmed' ? shared.userId : null
    )
    return savedResult(context, memberProfileId, 'added', email)
  })
}

/**
 * Modifie une adresse : son role est garde (la titulaire modifiee reste
 * titulaire, critere 9) et son compte suit la nouvelle adresse. Une nouvelle
 * valeur n'herite pas du refus des envois de l'ancienne (ADR 057). Une
 * adresse en attente modifiee par le bureau est activee d'office (design 4).
 */
export const updateMemberProfileEmailService = async (
  input: UpdateMemberProfileEmailInput
): Promise<MemberProfileEmailWriteResult> => {
  const parsed = updateMemberProfileEmailServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const {organizationId, memberProfileId, emailId, email} = parsed.data
  const context = await writeContext(organizationId)

  return withTenant(organizationId, async () => {
    const loaded = await loadProfileEmails(context, memberProfileId)
    if (!loaded) return {status: 'not_found'}
    const target = loaded.emails.find((row) => row.id === emailId)
    if (!target) return {status: 'not_found'}
    if (
      loaded.emails.some(
        (other) => other.id !== emailId && sameEmail(other.email, email)
      )
    ) {
      return {status: 'already_listed'}
    }

    const previous =
      target.status === MemberEmailStatusConst.ACTIVE
        ? accountOfEmail(loaded.accounts, target.email)
        : undefined
    const holder = await findEmailHolder(organizationId, email, {
      memberProfileId,
      userIds: loaded.accounts.map((account) => account.userId),
    })
    const shared = confirmedHolder(holder, parsed.data.confirmedAccountUserId)
    if (shared.kind === 'ask' && holder) {
      return {status: 'email_shared', holder}
    }
    const confirmedUserId = shared.kind === 'confirmed' ? shared.userId : null

    if (target.status === MemberEmailStatusConst.PENDING) {
      await activatePendingEmail({
        organizationId,
        profile: loaded.profile,
        pendingId: target.id,
        email,
        author: context.author,
        confirmedHolderUserId: confirmedUserId ?? undefined,
        now: context.now,
      })
      return savedResult(context, memberProfileId, 'updated', email)
    }

    const decision = decideMemberAccount({
      savedEmail: target.email,
      nextEmail: email,
      linkedRole: await getLinkedAccountRole(
        organizationId,
        previous?.userId ?? null
      ),
      previousAccountLinked: previous !== undefined,
      otherLinkedProfiles: await otherLinkedProfilesOf(
        organizationId,
        previous?.userId ?? null
      ),
      nextEmailAccountUserId: confirmedUserId,
    })
    await updateMemberProfileEmailDao(target.id, {
      email,
      ...(sameEmail(target.email, email) ? {} : {unsubscribedAt: null}),
    })
    await applyMemberAccountDecision({
      organizationId,
      author: context.author,
      profile: {
        id: loaded.profile.id,
        name: loaded.profile.name,
        email,
        userId: previous?.userId ?? null,
      },
      decision,
    })
    return savedResult(context, memberProfileId, 'updated', email)
  })
}

const replacementOf = (
  input: Pick<RemoveMemberProfileEmailInput, 'replacementEmailId'> & {
    replacementEmail: string | null
  }
): MemberEmailReplacement => {
  if (input.replacementEmailId) {
    return {kind: 'existing', emailId: input.replacementEmailId}
  }
  if (input.replacementEmail) {
    return {kind: 'new', email: input.replacementEmail}
  }
  return {kind: 'none'}
}

/**
 * Retire une adresse : son compte est delie de **cette** fiche, sa ligne
 * `member` ne part qu'avec sa derniere fiche (critere 10). La titulaire ne
 * part qu'avec sa remplacante, sauf la derniere adresse active (critere 9).
 * L'adresse d'un membre du bureau sur sa derniere fiche ne se retire pas.
 */
export const removeMemberProfileEmailService = async (
  input: RemoveMemberProfileEmailInput
): Promise<MemberProfileEmailWriteResult> => {
  const parsed = removeMemberProfileEmailServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const {organizationId, memberProfileId, emailId} = parsed.data
  const context = await writeContext(organizationId)

  return withTenant(organizationId, async () => {
    const loaded = await loadProfileEmails(context, memberProfileId)
    if (!loaded) return {status: 'not_found'}
    const plan = planEmailRemoval(
      loaded.emails,
      emailId,
      replacementOf(parsed.data)
    )
    if (!plan.ok) return {status: plan.reason}
    const target = loaded.emails.find((row) => row.id === plan.removeEmailId)
    if (!target) return {status: 'not_found'}

    const account =
      target.status === MemberEmailStatusConst.ACTIVE
        ? accountOfEmail(loaded.accounts, target.email)
        : undefined
    const decision = decideMemberAccount({
      savedEmail: target.email,
      nextEmail: null,
      linkedRole: await getLinkedAccountRole(
        organizationId,
        account?.userId ?? null
      ),
      previousAccountLinked: account !== undefined,
      otherLinkedProfiles: await otherLinkedProfilesOf(
        organizationId,
        account?.userId ?? null
      ),
      nextEmailAccountUserId: null,
    })
    if (decision.kind === 'refuse_board_removal') {
      return {status: 'board_email_required'}
    }
    if (plan.addHolderEmail) {
      const holder = await findEmailHolder(
        organizationId,
        plan.addHolderEmail,
        {
          memberProfileId,
          userIds: loaded.accounts.map((linked) => linked.userId),
        }
      )
      if (holder) return {status: 'email_shared', holder}
    }

    await deleteMemberProfileEmailDao(target.id)
    if (plan.promoteEmailId) {
      await setMemberProfileEmailRoleDao(
        plan.promoteEmailId,
        MemberEmailRoleConst.HOLDER
      )
    }
    if (plan.addHolderEmail) {
      await insertMemberProfileEmailDao({
        organizationId,
        memberProfileId,
        email: plan.addHolderEmail,
        role: MemberEmailRoleConst.HOLDER,
        status: MemberEmailStatusConst.ACTIVE,
        origin: MemberEmailOriginConst.SITE,
      })
      await openEmailAccount(context, loaded.profile, plan.addHolderEmail, null)
    }
    if (account) {
      await applyMemberAccountDecision({
        organizationId,
        author: context.author,
        profile: {
          id: loaded.profile.id,
          name: loaded.profile.name,
          email: null,
          userId: account.userId,
        },
        decision,
      })
    }
    return savedResult(context, memberProfileId, 'removed', target.email)
  })
}

/**
 * Designe une autre adresse active comme titulaire : l'ancienne devient
 * supplementaire, **retrogradee d'abord** (un seul titulaire actif, index
 * unique partiel). Aucun role du bureau ne bouge.
 */
export const designateMemberProfileHolderService = async (
  input: DesignateMemberProfileHolderInput
): Promise<MemberProfileEmailWriteResult> => {
  const parsed = designateMemberProfileHolderServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const {organizationId, memberProfileId, emailId} = parsed.data
  const context = await writeContext(organizationId)

  return withTenant(organizationId, async () => {
    const loaded = await loadProfileEmails(context, memberProfileId)
    if (!loaded) return {status: 'not_found'}
    const plan = planHolderDesignation(loaded.emails, emailId)
    if (!plan.ok) {
      return {
        status:
          plan.reason === 'not_found' ? 'not_found' : 'invalid_replacement',
      }
    }

    if (plan.demoteEmailId) {
      await setMemberProfileEmailRoleDao(
        plan.demoteEmailId,
        MemberEmailRoleConst.ADDITIONAL
      )
    }
    await setMemberProfileEmailRoleDao(
      plan.promoteEmailId,
      MemberEmailRoleConst.HOLDER
    )
    const promoted = loaded.emails.find((row) => row.id === plan.promoteEmailId)
    return savedResult(
      context,
      memberProfileId,
      'designated',
      promoted?.email ?? ''
    )
  })
}
