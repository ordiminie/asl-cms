import {
  OwnershipPeriod,
  OwnershipPeriodCandidate,
  SalePlan,
  SalePlanInput,
  SaleRefusalConst,
} from '../types/domain/parcel-ownership-types'

/**
 * Regles pures de la propriete datee (s12, ADR 029). Isomorphes : ni base, ni
 * horloge, ni import serveur — l'ecran de vente les rejoue pour ecrire « Ce
 * qui va changer ».
 *
 * Une periode est demi-ouverte `[startsOn, endsOn)` et ses dates sont des
 * chaines ISO `YYYY-MM-DD`, qui se comparent telles quelles.
 */

const byStart = (a: OwnershipPeriod, b: OwnershipPeriod): number =>
  a.startsOn.localeCompare(b.startsOn)

const covers = (period: OwnershipPeriodCandidate, date: string): boolean =>
  period.startsOn <= date && (period.endsOn === null || date < period.endsOn)

const endsAfter = (period: OwnershipPeriodCandidate, date: string): boolean =>
  period.endsOn === null || period.endsOn > date

/**
 * Le proprietaire d'une parcelle a une date : la fiche dont la periode couvre
 * ce jour. Le jour de la vente appartient a l'acquereur.
 */
export const ownerAt = (
  periods: OwnershipPeriod[],
  date: string
): string | undefined =>
  periods.find((period) => covers(period, date))?.memberProfileId

/**
 * La plus ancienne periode qui chevauche la candidate, ou rien. Deux periodes
 * contigues (`endsOn` de l'une = `startsOn` de l'autre) ne se chevauchent
 * pas ; une periode ouverte chevauche tout ce qui la suit.
 */
export const findOverlap = (
  periods: OwnershipPeriod[],
  candidate: OwnershipPeriodCandidate
): OwnershipPeriod | undefined =>
  [...periods]
    .sort(byStart)
    .find(
      (period) =>
        endsAfter(period, candidate.startsOn) &&
        endsAfter(candidate, period.startsOn)
    )

/**
 * Ce qu'une vente ecrirait, ou pourquoi elle est refusee. La cloture ne vise
 * jamais qu'une periode **ouverte** du vendeur : une periode close n'est plus
 * ecrite (ADR 029 §4).
 */
export const planSale = ({
  periods,
  sellerId,
  buyerId,
  date,
}: SalePlanInput): SalePlan => {
  if (buyerId === sellerId) {
    return {ok: false, reason: SaleRefusalConst.BUYER_IS_SELLER}
  }

  const sellerPeriod = periods.find(
    (period) => period.memberProfileId === sellerId && period.endsOn === null
  )
  if (!sellerPeriod) {
    return {ok: false, reason: SaleRefusalConst.NO_OPEN_PERIOD}
  }

  if (date <= sellerPeriod.startsOn) {
    return {
      ok: false,
      reason: SaleRefusalConst.DATE_NOT_AFTER_START,
      conflict: sellerPeriod,
    }
  }

  const others = periods.filter((period) => period.id !== sellerPeriod.id)
  const conflict = findOverlap(others, {startsOn: date, endsOn: null})
  if (conflict) {
    return {ok: false, reason: SaleRefusalConst.OVERLAP, conflict}
  }

  return {
    ok: true,
    close: {periodId: sellerPeriod.id, endsOn: date},
    open: {memberProfileId: buyerId, startsOn: date},
  }
}

/**
 * Ni rattachement ni vente a une date posterieure a aujourd'hui ; aujourd'hui
 * est accepte. Le jour courant est un **argument** : l'appelant lit l'horloge
 * (`calendarDayOf`), la regle reste pure, et l'ecran la rejoue telle quelle.
 */
export const isOwnershipDateInFuture = (date: string, today: string): boolean =>
  date > today

/**
 * Fiche incomplete (decision G) : joignable par courrier uniquement, et
 * aucune adresse postale exploitable — adresse, code postal et commune tous
 * absents. Aucun envoi ne peut l'atteindre.
 */
export const isIncomplete = (profile: {
  email: string | null
  addressLine: string | null
  postalCode: string | null
  city: string | null
}): boolean =>
  profile.email === null &&
  profile.addressLine === null &&
  profile.postalCode === null &&
  profile.city === null

/**
 * Le dernier jour de propriete d'une periode close : la **veille** de
 * `endsOn` (ADR 029). C'est la seule traduction entre la borne stockee, exclue,
 * et la date ecrite a l'ecran (« au 14/06/2026 » pour une vente le 15) ; elle
 * vit ici et nulle part ailleurs. Calcul en UTC, sans lire l'horloge.
 */
export const lastOwnershipDayOf = (endsOn: string): string => {
  const [year, month, day] = endsOn.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10)
}
