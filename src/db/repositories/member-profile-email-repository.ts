import {and, asc, eq, inArray, lte, ne, SQL, sql} from 'drizzle-orm'

import {user} from '@/db/models/auth-model'
import {
  AddMemberProfileEmailModel,
  memberProfileEmail,
  MemberProfileEmailModel,
  MemberProfileEmailRoleModel,
  MemberProfileEmailStatusModel,
} from '@/db/models/member-profile-email-model'
import {memberProfile} from '@/db/models/member-profile-model'
import {getCurrentParcelNumbersForMembersDao} from '@/db/repositories/campaign-repository'
import {getDb} from '@/db/tenant-scope'

/**
 * Adresses d'une fiche (s54, ADR 056). Sous RLS forcee : hors
 * `withTenant(organizationId, ...)`, rien ne sort et rien ne s'ecrit. Les
 * ecritures s'executent dans la transaction du scope de tenant ; la regle de
 * succession de la titulaire est appliquee par le service, avant.
 */

/** Une adresse et le nom de la personne qui l'a ajoutee, s'il y en a une. */
export type MemberProfileEmailRow = MemberProfileEmailModel & {
  addedByName: string | null
}

/** Une adresse active de l'association, par sa fiche. */
export type MemberProfileEmailCarrierRow = {
  id: string
  memberProfileId: string
  role: MemberProfileEmailRoleModel
}

export type MemberProfileEmailPatch = Partial<
  Pick<
    MemberProfileEmailModel,
    | 'email'
    | 'role'
    | 'status'
    | 'confirmationTokenHash'
    | 'expiresAt'
    | 'replacesEmailId'
    | 'unsubscribedAt'
    | 'origin'
    | 'addedByUserId'
  >
>

/**
 * La colonne `member_profile.id` **qualifiee** : Drizzle omet le nom de table
 * dans un select a une seule table, et un `"id"` nu dans une sous-requete se
 * lierait a la table interne. Les sous-requetes ci-dessous aliasent leur
 * table et comparent toujours a cette reference.
 */
export const OUTER_PROFILE_ID: SQL = sql.raw('"member_profile"."id"')

/**
 * L'adresse titulaire active d'une fiche, en sous-requete correlee : la
 * valeur que les lectures exposent comme « l'email de la fiche ».
 */
export const activeHolderEmailSql = (
  profileId: SQL = OUTER_PROFILE_ID
): SQL<string | null> =>
  sql<
    string | null
  >`(select mpe_holder."email" from "member_profile_email" mpe_holder where mpe_holder."member_profile_id" = ${profileId} and mpe_holder."role" = 'holder' and mpe_holder."status" = 'active' limit 1)`

/** « Courrier uniquement » : aucune adresse active (ADR 056 §2). */
export const mailOnlySql = (profileId: SQL = OUTER_PROFILE_ID): SQL<boolean> =>
  sql<boolean>`not exists (select 1 from "member_profile_email" mpe_active where mpe_active."member_profile_id" = ${profileId} and mpe_active."status" = 'active')`

/** Le nombre d'adresses actives supplementaires d'une fiche. */
export const otherActiveEmailCountSql = (
  profileId: SQL = OUTER_PROFILE_ID
): SQL<number> =>
  sql<number>`(select count(*)::int from "member_profile_email" mpe_other where mpe_other."member_profile_id" = ${profileId} and mpe_other."status" = 'active' and mpe_other."role" = 'additional')`

/**
 * Le compte relie a la fiche dont l'adresse de connexion est l'adresse
 * titulaire active, ou NULL.
 */
export const holderUserIdSql = (
  profileId: SQL = OUTER_PROFILE_ID
): SQL<string | null> =>
  sql<
    string | null
  >`(select mpa_holder."user_id" from "member_profile_account" mpa_holder inner join "user" u_holder on u_holder."id" = mpa_holder."user_id" where mpa_holder."member_profile_id" = ${profileId} and lower(u_holder."email") = lower(${activeHolderEmailSql(profileId)}) limit 1)`

/**
 * Les adresses de ces fiches, titulaire d'abord puis par anciennete, avec
 * le nom de leur auteur. Les attentes echues sont rendues : la regle pure les
 * ignore a la lecture.
 */
export const getMemberProfileEmailsDao = async (
  memberProfileIds: string[]
): Promise<MemberProfileEmailRow[]> => {
  if (memberProfileIds.length === 0) return []

  const rows = await getDb()
    .select({email: memberProfileEmail, addedByName: user.name})
    .from(memberProfileEmail)
    .leftJoin(user, eq(user.id, memberProfileEmail.addedByUserId))
    .where(inArray(memberProfileEmail.memberProfileId, memberProfileIds))
    .orderBy(
      asc(memberProfileEmail.role),
      asc(memberProfileEmail.createdAt),
      asc(memberProfileEmail.id)
    )
  return rows.map((row) => ({...row.email, addedByName: row.addedByName}))
}

/** Une adresse par son identifiant, ou rien (hors tenant : rien). */
export const getMemberProfileEmailByIdDao = async (
  emailId: string
): Promise<MemberProfileEmailModel | undefined> => {
  const [row] = await getDb()
    .select()
    .from(memberProfileEmail)
    .where(eq(memberProfileEmail.id, emailId))
  return row
}

/**
 * Les adresses **actives** de l'association egales sans casse a celle-ci,
 * par fiche : qui porte deja une adresse (critere 7, s53).
 */
export const getActiveEmailCarriersDao = async (
  organizationId: string,
  email: string
): Promise<MemberProfileEmailCarrierRow[]> =>
  getDb()
    .select({
      id: memberProfileEmail.id,
      memberProfileId: memberProfileEmail.memberProfileId,
      role: memberProfileEmail.role,
    })
    .from(memberProfileEmail)
    .where(
      and(
        eq(memberProfileEmail.organizationId, organizationId),
        sql`lower(${memberProfileEmail.email}) = lower(${email})`,
        eq(memberProfileEmail.status, 'active')
      )
    )
    .orderBy(asc(memberProfileEmail.memberProfileId))

export const insertMemberProfileEmailDao = async (
  input: AddMemberProfileEmailModel
): Promise<MemberProfileEmailModel> => {
  const [row] = await getDb()
    .insert(memberProfileEmail)
    .values(input)
    .returning()
  return row
}

export const updateMemberProfileEmailDao = async (
  emailId: string,
  patch: MemberProfileEmailPatch
): Promise<MemberProfileEmailModel | undefined> => {
  const [row] = await getDb()
    .update(memberProfileEmail)
    .set({...patch, updatedAt: sql`now()`})
    .where(eq(memberProfileEmail.id, emailId))
    .returning()
  return row
}

/**
 * Change le role d'une adresse. Une designation retrograde l'ancienne
 * titulaire **avant** de promouvoir la nouvelle : l'index unique partiel
 * refuse deux titulaires actives, meme un instant.
 */
export const setMemberProfileEmailRoleDao = async (
  emailId: string,
  role: MemberProfileEmailRoleModel
): Promise<void> => {
  await getDb()
    .update(memberProfileEmail)
    .set({role, updatedAt: sql`now()`})
    .where(eq(memberProfileEmail.id, emailId))
}

export const deleteMemberProfileEmailDao = async (
  emailId: string
): Promise<void> => {
  await getDb()
    .delete(memberProfileEmail)
    .where(eq(memberProfileEmail.id, emailId))
}

/**
 * Purge les adresses en attente echues de l'association (ADR 056 §5) :
 * appelee par l'ecriture suivante, aucune tache planifiee.
 */
export const purgeExpiredPendingEmailsDao = async (
  organizationId: string,
  now: Date
): Promise<void> => {
  await getDb()
    .delete(memberProfileEmail)
    .where(
      and(
        eq(memberProfileEmail.organizationId, organizationId),
        eq(memberProfileEmail.status, 'pending'),
        lte(memberProfileEmail.expiresAt, now)
      )
    )
}

/**
 * Les adresses en attente d'un meme lien, par le hash de son jeton : une
 * adresse ajoutee par un membre a plusieurs terrains l'est sur chacune de ses
 * fiches, sous un seul lien (arbitrage du 16/11, ADR 056 §4).
 */
export const getMemberProfileEmailsByTokenHashDao = async (
  tokenHash: string
): Promise<MemberProfileEmailModel[]> =>
  getDb()
    .select()
    .from(memberProfileEmail)
    .where(eq(memberProfileEmail.confirmationTokenHash, tokenHash))
    .orderBy(asc(memberProfileEmail.id))

/**
 * Supprime les adresses en attente qu'un compte a ajoutees sur une fiche :
 * appelee quand ce compte en est delie (revue s54, C1). Un auteur qui n'a
 * plus acces a la fiche ne peut plus y faire activer d'adresse.
 */
export const deletePendingEmailsAddedByDao = async (
  memberProfileId: string,
  userId: string
): Promise<void> => {
  await getDb()
    .delete(memberProfileEmail)
    .where(
      and(
        eq(memberProfileEmail.memberProfileId, memberProfileId),
        eq(memberProfileEmail.addedByUserId, userId),
        eq(memberProfileEmail.status, 'pending')
      )
    )
}

/** Une adresse de fiche telle que le suivi des invitations la lit (s42b). */
export type InvitationAddressRowModel = Pick<
  MemberProfileEmailModel,
  'email' | 'status' | 'createdAt' | 'expiresAt' | 'memberProfileId'
> & {name: string; parcelNumbers: string[]}

/**
 * Toutes les adresses de fiche de l'association, **actives et en attente**,
 * avec le nom et les parcelles actuelles de leur fiche (s42b, critere 7).
 * Les attentes echues sont rendues : la regle pure les masque. Une adresse
 * desactivee par l'import (s56, ADR 076) n'en est pas.
 */
export const getInvitationAddressesDao = async (
  organizationId: string
): Promise<InvitationAddressRowModel[]> => {
  const rows = await getDb()
    .select({
      email: memberProfileEmail.email,
      status: memberProfileEmail.status,
      createdAt: memberProfileEmail.createdAt,
      expiresAt: memberProfileEmail.expiresAt,
      memberProfileId: memberProfileEmail.memberProfileId,
      name: memberProfile.name,
    })
    .from(memberProfileEmail)
    .innerJoin(
      memberProfile,
      eq(memberProfile.id, memberProfileEmail.memberProfileId)
    )
    .where(
      and(
        eq(memberProfileEmail.organizationId, organizationId),
        ne(memberProfileEmail.status, 'disabled_by_import')
      )
    )
    .orderBy(asc(memberProfile.name), asc(memberProfileEmail.email))

  const numbers = await getCurrentParcelNumbersForMembersDao([
    ...new Set(rows.map((row) => row.memberProfileId)),
  ])
  return rows.map((row) => ({
    ...row,
    parcelNumbers: numbers[row.memberProfileId] ?? [],
  }))
}

/**
 * Change le statut et le role d'une adresse (s56, ADR 076) : desactivee par
 * l'import (toujours supplementaire), ou reactivee. La ligne est conservee,
 * sa desinscription (`unsubscribed_at`) intacte.
 */
export const setMemberProfileEmailStatusDao = async (
  emailId: string,
  patch: {
    status: MemberProfileEmailStatusModel
    role: MemberProfileEmailRoleModel
  }
): Promise<void> => {
  await getDb()
    .update(memberProfileEmail)
    .set({role: patch.role, status: patch.status, updatedAt: sql`now()`})
    .where(eq(memberProfileEmail.id, emailId))
}
