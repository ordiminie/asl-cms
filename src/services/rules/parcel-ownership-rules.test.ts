import {describe, expect, it} from 'vitest'

import {OwnershipPeriod} from '../types/domain/parcel-ownership-types'
import {
  findOverlap,
  isIncomplete,
  lastOwnershipDayOf,
  ownerAt,
  planSale,
} from './parcel-ownership-rules'

const DUBOIS = 'dubois'
const ROY = 'roy'

/**
 * La parcelle 47 : Dubois depuis le 03/02/1998, vendue a Roy le 15/06/2026.
 * Periodes demi-ouvertes : le jour de la vente appartient a l'acquereur.
 */
const PARCEL_47: OwnershipPeriod[] = [
  {
    id: 'period-dubois',
    memberProfileId: DUBOIS,
    startsOn: '1998-02-03',
    endsOn: '2026-06-15',
  },
  {
    id: 'period-roy',
    memberProfileId: ROY,
    startsOn: '2026-06-15',
    endsOn: null,
  },
]

describe('ownerAt — la parcelle vendue (critère 3)', () => {
  it('rend le vendeur la veille de la vente', () => {
    expect(ownerAt(PARCEL_47, '2026-06-14')).toBe(DUBOIS)
  })

  it("rend l'acquéreur le jour de la vente", () => {
    expect(ownerAt(PARCEL_47, '2026-06-15')).toBe(ROY)
  })

  it("rend l'acquéreur après la vente", () => {
    expect(ownerAt(PARCEL_47, '2031-01-01')).toBe(ROY)
  })

  it('ne rend personne avant le premier propriétaire', () => {
    expect(ownerAt(PARCEL_47, '1998-02-02')).toBeUndefined()
  })

  it('rend le vendeur dès son premier jour', () => {
    expect(ownerAt(PARCEL_47, '1998-02-03')).toBe(DUBOIS)
  })
})

describe('findOverlap — périodes demi-ouvertes (critère 4)', () => {
  const closed: OwnershipPeriod = PARCEL_47[0]
  const open: OwnershipPeriod = PARCEL_47[1]

  it('ne voit pas de chevauchement entre deux périodes contiguës', () => {
    expect(
      findOverlap([closed], {startsOn: '2026-06-15', endsOn: null})
    ).toBeUndefined()
    expect(
      findOverlap([open], {startsOn: '2020-01-01', endsOn: '2026-06-15'})
    ).toBeUndefined()
  })

  it('rend la période en place quand la candidate commence un jour trop tôt', () => {
    expect(findOverlap([closed], {startsOn: '2026-06-14', endsOn: null})).toBe(
      closed
    )
  })

  it('fait chevaucher une période ouverte avec tout ce qui la suit', () => {
    expect(
      findOverlap([open], {startsOn: '2030-01-01', endsOn: '2031-01-01'})
    ).toBe(open)
    expect(findOverlap([open], {startsOn: '2040-01-01', endsOn: null})).toBe(
      open
    )
  })

  it('fait chevaucher une candidate ouverte avec une période postérieure', () => {
    expect(findOverlap([closed], {startsOn: '1990-01-01', endsOn: null})).toBe(
      closed
    )
  })

  it('ne voit rien avant une période close', () => {
    expect(
      findOverlap([closed], {startsOn: '1990-01-01', endsOn: '1998-02-03'})
    ).toBeUndefined()
  })

  it('rend la plus ancienne des périodes en conflit', () => {
    expect(
      findOverlap([open, closed], {startsOn: '2000-01-01', endsOn: null})
    ).toBe(closed)
  })
})

describe('planSale — une vente (critères 2 et 4)', () => {
  const BLANC = 'blanc'
  const openForDubois: OwnershipPeriod[] = [
    {
      id: 'period-dubois',
      memberProfileId: DUBOIS,
      startsOn: '1998-02-03',
      endsOn: null,
    },
  ]

  it("clôt la période ouverte du vendeur et ouvre celle de l'acquéreur le même jour", () => {
    expect(
      planSale({
        periods: openForDubois,
        sellerId: DUBOIS,
        buyerId: ROY,
        date: '2026-06-15',
      })
    ).toEqual({
      ok: true,
      close: {periodId: 'period-dubois', endsOn: '2026-06-15'},
      open: {memberProfileId: ROY, startsOn: '2026-06-15'},
    })
  })

  it('accepte une vente le lendemain du début de la période', () => {
    expect(
      planSale({
        periods: openForDubois,
        sellerId: DUBOIS,
        buyerId: ROY,
        date: '1998-02-04',
      })
    ).toMatchObject({ok: true})
  })

  it.each([
    ['le jour du début', '1998-02-03'],
    ['avant le début', '1997-12-31'],
  ])('refuse une vente %s de la période du vendeur', (_label, date) => {
    expect(
      planSale({periods: openForDubois, sellerId: DUBOIS, buyerId: ROY, date})
    ).toEqual({
      ok: false,
      reason: 'date_not_after_start',
      conflict: openForDubois[0],
    })
  })

  it("refuse quand l'acquéreur est le vendeur", () => {
    expect(
      planSale({
        periods: openForDubois,
        sellerId: DUBOIS,
        buyerId: DUBOIS,
        date: '2026-06-15',
      })
    ).toEqual({ok: false, reason: 'buyer_is_seller'})
  })

  it("refuse quand le vendeur n'a pas de période ouverte sur la parcelle", () => {
    expect(
      planSale({
        periods: PARCEL_47,
        sellerId: DUBOIS,
        buyerId: BLANC,
        date: '2027-01-01',
      })
    ).toEqual({ok: false, reason: 'no_open_period'})
  })

  it('ne propose jamais de clore une période déjà close', () => {
    const plan = planSale({
      periods: PARCEL_47,
      sellerId: ROY,
      buyerId: BLANC,
      date: '2030-03-01',
    })

    expect(plan).toEqual({
      ok: true,
      close: {periodId: 'period-roy', endsOn: '2030-03-01'},
      open: {memberProfileId: BLANC, startsOn: '2030-03-01'},
    })
  })

  it('refuse un chevauchement avec une période postérieure', () => {
    const later: OwnershipPeriod = {
      id: 'period-later',
      memberProfileId: BLANC,
      startsOn: '2030-01-01',
      endsOn: '2035-01-01',
    }

    expect(
      planSale({
        periods: [...openForDubois, later],
        sellerId: DUBOIS,
        buyerId: ROY,
        date: '2026-06-15',
      })
    ).toEqual({ok: false, reason: 'overlap', conflict: later})
  })
})

describe('isIncomplete — fiche incomplète (critère 8)', () => {
  const noContact = {
    email: null,
    addressLine: null,
    postalCode: null,
    city: null,
  }

  it('signale une fiche sans email ni adresse postale', () => {
    expect(isIncomplete(noContact)).toBe(true)
  })

  it('ne signale pas une fiche qui porte un email, même sans adresse', () => {
    expect(isIncomplete({...noContact, email: 'claire@example.org'})).toBe(
      false
    )
  })

  it.each([
    ['une adresse', {addressLine: '12 chemin des Pins'}],
    ['un code postal', {postalCode: '97400'}],
    ['une commune', {city: 'Saint-Denis'}],
  ])('ne signale pas une fiche courrier qui porte %s', (_label, part) => {
    expect(isIncomplete({...noContact, ...part})).toBe(false)
  })
})

describe('lastOwnershipDayOf — le dernier jour du vendeur est la veille de la vente', () => {
  it.each([
    ['2026-06-15', '2026-06-14'],
    ['2026-03-01', '2026-02-28'],
    ['2024-03-01', '2024-02-29'],
    ['2026-01-01', '2025-12-31'],
  ])('%s → %s', (endsOn, lastDay) => {
    expect(lastOwnershipDayOf(endsOn)).toBe(lastDay)
  })
})
