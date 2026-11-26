import 'server-only'

import {
  getMemberProfilesByUserIdDao,
  MyMemberProfileRow,
} from '@/db/repositories/member-profile-repository'
import {listOwnershipPeriodsByProfilesDao} from '@/db/repositories/parcel-ownership-repository'
import {withTenant} from '@/db/tenant-scope'

import {getAssociationSettingsService} from './association-settings-service'
import {ValidationParsedZodError} from './errors/validation-error'
import {profileAccessOf} from './rules/member-profile-access-rules'
import {orderMyProfiles} from './rules/my-profiles-order-rules'
import {getMemberAccessAfterSaleMonths} from './types/domain/association-settings-types'
import type {ProfileAccess} from './types/domain/member-profile-access-types'
import {calendarDayOf} from './types/domain/water-analysis-types'
import {memberProfileOrganizationIdSchema} from './validation/member-profile-validation'

/**
 * Accès d'un compte à ses fiches après la vente (s57, ADR 075 §3-4). L'état
 * de chaque fiche est recalculé à chaque lecture depuis ses périodes et le
 * délai du tenant : rien n'est stocké, rien n'est supprimé.
 */

/** Une fiche reliée au compte, avec son état d'accès du jour. */
export type AccessibleProfile = MyMemberProfileRow & {access: ProfileAccess}

/** Le délai du tenant et le jour calendaire de Paris de `now`. */
const readAccessClock = async (organizationId: string, now: Date) => ({
  months: getMemberAccessAfterSaleMonths(
    await getAssociationSettingsService(organizationId)
  ),
  today: calendarDayOf(now),
})

/** Toutes les fiches reliées au compte, chacune avec son état du jour. */
const readProfilesWithAccess = async (
  organizationId: string,
  userId: string
): Promise<AccessibleProfile[]> =>
  withTenant(organizationId, async () => {
    const profiles = await getMemberProfilesByUserIdDao(organizationId, userId)
    if (profiles.length === 0) return []
    const periods = await listOwnershipPeriodsByProfilesDao(
      profiles.map((profile) => profile.id)
    )
    const {months, today} = await readAccessClock(organizationId, new Date())
    return profiles.map((profile) => ({
      ...profile,
      access: profileAccessOf(
        periods.filter((period) => period.memberProfileId === profile.id),
        months,
        today
      ),
    }))
  })

/**
 * Les fiches reliées au compte que l'espace membre peut encore servir : hors
 * `closed`, dans l'ordre de l'ADR 054 §7. Côté membre seulement : le bureau
 * garde `getMyMemberProfiles`, qui voit toutes les fiches.
 */
export const getMyAccessibleProfiles = async (
  organizationId: string,
  userId: string
): Promise<AccessibleProfile[]> =>
  orderMyProfiles(
    (await readProfilesWithAccess(organizationId, userId)).filter(
      (profile) => profile.access.status !== 'closed'
    )
  )

/**
 * Vrai si le compte garde l'espace membre de l'association : aucune fiche
 * reliée (hors règle), ou au moins une fiche hors `closed`.
 *
 * **Sans contrôle d'autorisation, et c'est délibéré** : appelée par la règle
 * de session (`canOpenSessionOn`, ADR 075 §3) avant toute session, comme
 * `getAssociationSettingsService`. Ne rend qu'un booléen.
 */
export const hasMemberSpaceAccessService = async (
  organizationId: string,
  userId: string
): Promise<boolean> => {
  const parsed = memberProfileOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) throw new ValidationParsedZodError(parsed.error)

  const profiles = await readProfilesWithAccess(parsed.data, userId)
  return (
    profiles.length === 0 ||
    profiles.some((profile) => profile.access.status !== 'closed')
  )
}

/**
 * L'état d'accès d'une fiche (s57, ADR 075 §1), pour le bureau (date de fin
 * d'accès, refus d'invitation) : ses périodes, le délai du tenant et le jour
 * de `now`, sous le scope de l'association. Sans contrôle d'autorisation :
 * appelée par des services du bureau après le leur.
 */
export const readProfileAccess = async (
  organizationId: string,
  memberProfileId: string,
  now: Date
): Promise<ProfileAccess> =>
  withTenant(organizationId, async () => {
    const periods = await listOwnershipPeriodsByProfilesDao([memberProfileId])
    const {months, today} = await readAccessClock(organizationId, now)
    return profileAccessOf(periods, months, today)
  })
