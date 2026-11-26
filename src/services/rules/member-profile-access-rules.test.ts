import {describe, expect, it} from 'vitest'

import {
  accessWindowOf,
  addMonthsToDay,
  isBeforeSale,
  profileAccessOf,
} from './member-profile-access-rules'

const closed = (startsOn: string, endsOn: string) => ({startsOn, endsOn})
const open = (startsOn: string) => ({startsOn, endsOn: null})

describe('addMonthsToDay — jours calendaires, sans fuseau', () => {
  it('ajoute des mois en gardant le jour', () => {
    expect(addMonthsToDay('2026-06-15', 6)).toBe('2026-12-15')
  })

  it('franchit l’année', () => {
    expect(addMonthsToDay('2026-11-30', 3)).toBe('2027-02-28')
  })

  it('ramène le 31/08 + 6 mois au 28/02', () => {
    expect(addMonthsToDay('2026-08-31', 6)).toBe('2027-02-28')
  })

  it('ramène le 31/08 + 6 mois au 29/02 une année bissextile', () => {
    expect(addMonthsToDay('2027-08-31', 6)).toBe('2028-02-29')
  })

  it('accepte un délai de plusieurs années', () => {
    expect(addMonthsToDay('2026-01-31', 25)).toBe('2028-02-29')
  })
})

describe('profileAccessOf — état d’une fiche après la vente (ADR 075 §1)', () => {
  const sale = '2026-06-15'
  const closesOn = '2026-12-15'

  it('critère 3 — la veille de l’échéance, la fiche est encore ouverte', () => {
    expect(
      profileAccessOf([closed('1998-02-03', sale)], 6, '2026-12-14')
    ).toEqual({status: 'grace', soldOn: sale, closesOn})
  })

  it('critère 3 — le jour de l’échéance, la fiche est fermée', () => {
    expect(profileAccessOf([closed('1998-02-03', sale)], 6, closesOn)).toEqual({
      status: 'closed',
      soldOn: sale,
      closesOn,
    })
  })

  it('critère 3 — le lendemain de l’échéance, la fiche est fermée', () => {
    expect(
      profileAccessOf([closed('1998-02-03', sale)], 6, '2026-12-16')
    ).toEqual({status: 'closed', soldOn: sale, closesOn})
  })

  it('le jour même de la vente, la fiche est dans le délai', () => {
    expect(profileAccessOf([closed('1998-02-03', sale)], 6, sale)).toEqual({
      status: 'grace',
      soldOn: sale,
      closesOn,
    })
  })

  it('plusieurs parcelles vendues à des dates différentes : la plus tardive compte', () => {
    expect(
      profileAccessOf(
        [
          closed('2001-01-01', '2026-03-01'),
          closed('2001-01-01', '2026-06-15'),
          closed('2001-01-01', '2025-01-10'),
        ],
        6,
        '2026-11-26'
      )
    ).toEqual({status: 'grace', soldOn: '2026-06-15', closesOn: '2026-12-15'})
  })

  it('critère 4 — une période ouverte parmi des closes : la fiche est propriétaire', () => {
    expect(
      profileAccessOf(
        [closed('2001-01-01', '2019-05-01'), open('2010-01-01')],
        6,
        '2026-11-26'
      )
    ).toEqual({status: 'owner'})
  })

  it('une fiche sans aucune période est hors règle', () => {
    expect(profileAccessOf([], 6, '2026-11-26')).toEqual({
      status: 'out_of_rule',
    })
  })

  it('un changement du délai recalcule l’état, y compris d’une fiche fermée', () => {
    const periods = [closed('2001-01-01', '2026-03-01')]

    expect(profileAccessOf(periods, 6, '2026-11-26').status).toBe('closed')
    expect(profileAccessOf(periods, 12, '2026-11-26')).toEqual({
      status: 'grace',
      soldOn: '2026-03-01',
      closesOn: '2027-03-01',
    })
  })
})

describe('isBeforeSale — visibilité pendant le délai (ADR 075 §5)', () => {
  const grace = {
    status: 'grace' as const,
    soldOn: '2026-06-15',
    closesOn: '2026-12-15',
  }

  it('vrai la veille de la vente', () => {
    expect(isBeforeSale('2026-06-14', grace)).toBe(true)
  })

  it('faux le jour même de la vente', () => {
    expect(isBeforeSale('2026-06-15', grace)).toBe(false)
  })

  it('faux après la vente', () => {
    expect(isBeforeSale('2026-09-01', grace)).toBe(false)
  })

  it('toujours vrai pour une fiche propriétaire ou hors règle', () => {
    expect(isBeforeSale('2030-01-01', {status: 'owner'})).toBe(true)
    expect(isBeforeSale('2030-01-01', {status: 'out_of_rule'})).toBe(true)
  })
})

describe('accessWindowOf — la date de fin d’accès lue par le bureau (critère 8)', () => {
  it('en délai : le dernier jour ouvert est la veille de l’échéance', () => {
    expect(
      accessWindowOf({
        status: 'grace',
        soldOn: '2026-06-15',
        closesOn: '2026-12-15',
      })
    ).toEqual({status: 'grace', soldOn: '2026-06-15', openUntil: '2026-12-14'})
  })

  it('fermé : le premier jour fermé est l’échéance', () => {
    expect(
      accessWindowOf({
        status: 'closed',
        soldOn: '2026-02-03',
        closesOn: '2026-08-03',
      })
    ).toEqual({
      status: 'closed',
      soldOn: '2026-02-03',
      closedSince: '2026-08-03',
    })
  })

  it('l’échéance au 1er du mois : la veille est le dernier jour du mois précédent', () => {
    expect(
      accessWindowOf({
        status: 'grace',
        soldOn: '2026-09-01',
        closesOn: '2027-03-01',
      })
    ).toMatchObject({openUntil: '2027-02-28'})
  })

  it('propriétaire ou hors règle : aucune date', () => {
    expect(accessWindowOf({status: 'owner'})).toBeNull()
    expect(accessWindowOf({status: 'out_of_rule'})).toBeNull()
  })
})
