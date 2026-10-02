import 'server-only'

import {getMemberProfileByIdDao} from '@/db/repositories/member-profile-repository'
import {
  closeOpenPeriodTxnDao,
  findOrCreateParcelTxnDao,
  getCurrentParcelsByMemberDao,
  getFormerParcelsByMemberDao,
  getParcelByIdDao,
  getParcelOwnerAtDao,
  getParcelPeriodsDao,
  lockParcelTxnDao,
  openPeriodTxnDao,
  ParcelPeriodRow,
} from '@/db/repositories/parcel-ownership-repository'
import {withTenant} from '@/db/tenant-scope'

import {getAuthUser} from './authentication/auth-service'
import {canPerformAction} from './authorization/action-registry-authorization'
import {AuthorizationError} from './errors/authorization-error'
import {ValidationParsedZodError} from './errors/validation-error'
import {toMemberProfileDto} from './rules/member-profile-rules'
import {findOverlap, planSale} from './rules/parcel-ownership-rules'
import {ActionIdConst} from './types/domain/action-registry-types'
import {MemberProfileDTO} from './types/domain/member-profile-types'
import {
  AttachParcelInput,
  AttachParcelResult,
  MemberParcelsDTO,
  OwnershipConflictDTO,
  OwnershipPeriod,
  RecordSaleInput,
  RecordSaleResult,
  SaleContextDTO,
  SalePlan,
  SaleRefusalConst,
} from './types/domain/parcel-ownership-types'
import {
  attachParcelServiceSchema,
  memberParcelsServiceSchema,
  parcelOwnerAtServiceSchema,
  recordSaleServiceSchema,
  saleContextServiceSchema,
} from './validation/parcel-ownership-validation'

/**
 * Propriete datee des parcelles (s12, ADR 029). Chaque fonction : validation,
 * puis `member.profile.manage`, puis le repository sous le scope du tenant.
 *
 * Le non-chevauchement est une garantie **applicative** : tout chemin
 * d'ecriture d'une periode passe par `attachParcelService` ou
 * `recordSaleService`, qui verrouillent la parcelle avant de lire ses periodes
 * et d'appliquer les regles pures. Jamais par un DAO direct.
 */

const MANAGE_DENIED =
  "Seul le bureau de l'association peut gérer les parcelles des propriétaires"

const requireMemberProfileManager = async (
  organizationId: string
): Promise<void> => {
  const authUser = await getAuthUser()
  if (
    !canPerformAction(
      authUser,
      organizationId,
      ActionIdConst.MEMBER_PROFILE_MANAGE
    )
  ) {
    throw new AuthorizationError(MANAGE_DENIED)
  }
}

const toPeriod = (row: ParcelPeriodRow): OwnershipPeriod => ({
  id: row.id,
  memberProfileId: row.memberProfileId,
  startsOn: row.startsOn,
  endsOn: row.endsOn,
})

/** Le proprietaire en place, nomme, pour un refus explicite (critere 4). */
const toConflict = (
  rows: ParcelPeriodRow[],
  period: OwnershipPeriod
): OwnershipConflictDTO => ({
  memberProfileId: period.memberProfileId,
  name: rows.find((row) => row.id === period.id)?.memberName ?? '',
  startsOn: period.startsOn,
  endsOn: period.endsOn,
})

const byParcelNumber = (a: {number: string}, b: {number: string}): number =>
  a.number.localeCompare(b.number, 'fr', {numeric: true})

/**
 * Rattache une parcelle a une fiche a partir d'une date (critere 1). La
 * parcelle inconnue est creee. Si un autre proprietaire la possede sur cette
 * periode, le rattachement est refuse en le nommant (critere 4).
 */
export const attachParcelService = async (
  input: AttachParcelInput
): Promise<AttachParcelResult> => {
  const parsed = attachParcelServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const {organizationId, memberProfileId, parcelNumber, startsOn} = parsed.data
  await requireMemberProfileManager(organizationId)

  return withTenant(organizationId, async () => {
    const profile = await getMemberProfileByIdDao(memberProfileId)
    if (!profile) return {status: 'member_not_found'}

    const {row: parcel, created} = await findOrCreateParcelTxnDao(
      organizationId,
      parcelNumber
    )
    await lockParcelTxnDao(parcel.id)

    const rows = await getParcelPeriodsDao(parcel.id)
    const overlap = findOverlap(rows.map(toPeriod), {startsOn, endsOn: null})
    if (overlap) {
      return {
        status: 'overlap',
        parcelNumber: parcel.number,
        conflict: toConflict(rows, overlap),
      }
    }

    await openPeriodTxnDao({
      organizationId,
      parcelId: parcel.id,
      memberProfileId,
      startsOn,
    })
    return {
      status: 'attached',
      parcelId: parcel.id,
      parcelNumber: parcel.number,
      parcelCreated: created,
    }
  })
}

const toSaleRefusal = (
  rows: ParcelPeriodRow[],
  plan: Extract<SalePlan, {ok: false}>
): RecordSaleResult => {
  switch (plan.reason) {
    case SaleRefusalConst.DATE_NOT_AFTER_START:
      return {
        status: 'date_not_after_start',
        startsOn: plan.conflict?.startsOn ?? '',
      }
    case SaleRefusalConst.OVERLAP:
      return {
        status: 'overlap',
        conflict: plan.conflict ? toConflict(rows, plan.conflict) : null,
      }
    default:
      return {status: plan.reason}
  }
}

/**
 * Enregistre une vente (critere 2), tout ou rien : verrou de la parcelle,
 * regles pures, **une** ecriture sur la periode ouverte du vendeur (sa date
 * de fin), puis la periode de l'acquereur a partir du meme jour. Un refus
 * n'ecrit rien ; une erreur en cours de route sort du scope de tenant et
 * annule la cloture.
 */
export const recordSaleService = async (
  input: RecordSaleInput
): Promise<RecordSaleResult> => {
  const parsed = recordSaleServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const {organizationId, parcelId, sellerId, buyerId, date} = parsed.data
  await requireMemberProfileManager(organizationId)

  return withTenant(organizationId, async () => {
    const parcel = await lockParcelTxnDao(parcelId)
    if (!parcel) return {status: 'not_found'}

    const buyer = await getMemberProfileByIdDao(buyerId)
    if (!buyer) return {status: 'not_found'}

    const rows = await getParcelPeriodsDao(parcelId)
    const plan = planSale({
      periods: rows.map(toPeriod),
      sellerId,
      buyerId,
      date,
    })
    if (!plan.ok) return toSaleRefusal(rows, plan)

    const closed = await closeOpenPeriodTxnDao(
      plan.close.periodId,
      plan.close.endsOn
    )
    if (!closed) {
      throw new Error("La période du vendeur n'est plus ouverte")
    }

    await openPeriodTxnDao({
      organizationId,
      parcelId,
      memberProfileId: plan.open.memberProfileId,
      startsOn: plan.open.startsOn,
    })
    return {status: 'recorded'}
  })
}

/**
 * Le proprietaire d'une parcelle a une date (critere 3, decision F) : la
 * fiche, ou rien. **Point d'entree de s18, s19, s28 et s32** : periode
 * demi-ouverte, le jour de la vente appartient a l'acquereur.
 */
export const getParcelOwnerAtService = async (
  organizationId: string,
  parcelId: string,
  date: string
): Promise<MemberProfileDTO | undefined> => {
  const parsed = parcelOwnerAtServiceSchema.safeParse({
    organizationId,
    parcelId,
    date,
  })
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requireMemberProfileManager(parsed.data.organizationId)

  const row = await withTenant(parsed.data.organizationId, () =>
    getParcelOwnerAtDao(parsed.data.parcelId, parsed.data.date)
  )
  return row ? toMemberProfileDto(row) : undefined
}

/**
 * Les parcelles d'une fiche (critere 5) : les actuelles, et les anciennes avec
 * leur acquereur. Une fiche, autant de parcelles qu'il faut.
 */
export const getMemberParcelsService = async (
  organizationId: string,
  memberProfileId: string
): Promise<MemberParcelsDTO> => {
  const parsed = memberParcelsServiceSchema.safeParse({
    organizationId,
    memberProfileId,
  })
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requireMemberProfileManager(parsed.data.organizationId)

  const [current, former] = await withTenant(
    parsed.data.organizationId,
    async () =>
      [
        await getCurrentParcelsByMemberDao(parsed.data.memberProfileId),
        await getFormerParcelsByMemberDao(parsed.data.memberProfileId),
      ] as const
  )

  return {
    current: [...current].sort(byParcelNumber),
    former: [...former].sort(byParcelNumber).map((row) => ({
      parcelId: row.parcelId,
      number: row.number,
      startsOn: row.startsOn,
      endsOn: row.endsOn,
      soldTo:
        row.buyerId && row.buyerName
          ? {memberProfileId: row.buyerId, name: row.buyerName}
          : null,
    })),
  }
}

/**
 * Le contexte de l'ecran de vente : la parcelle, le vendeur et toutes les
 * periodes de la parcelle — de quoi rejouer `planSale` a l'ecran pour ecrire
 * « Ce qui va changer ». Rien si la fiche ne possede pas (ou plus) la parcelle.
 */
export const getSaleContextService = async (
  organizationId: string,
  sellerId: string,
  parcelId: string
): Promise<SaleContextDTO | undefined> => {
  const parsed = saleContextServiceSchema.safeParse({
    organizationId,
    sellerId,
    parcelId,
  })
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  await requireMemberProfileManager(parsed.data.organizationId)

  return withTenant(parsed.data.organizationId, async () => {
    const parcel = await getParcelByIdDao(parsed.data.parcelId)
    if (!parcel) return undefined

    const rows = await getParcelPeriodsDao(parcel.id)
    const sellerRow = rows.find(
      (row) =>
        row.memberProfileId === parsed.data.sellerId && row.endsOn === null
    )
    if (!sellerRow) return undefined

    return {
      parcelId: parcel.id,
      parcelNumber: parcel.number,
      seller: {
        memberProfileId: sellerRow.memberProfileId,
        name: sellerRow.memberName,
      },
      periods: rows.map((row) => ({
        ...toPeriod(row),
        memberName: row.memberName,
      })),
    }
  })
}
