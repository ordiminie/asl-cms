import {describe, expect, it} from 'vitest'

import {
  findOverlap,
  isIncomplete,
  ownerAt,
} from '@/services/rules/parcel-ownership-rules'
import {
  MEMBER_PROFILE_NAME_MAX_LENGTH,
  MEMBER_PROFILE_POSTAL_CODE_PATTERN,
} from '@/services/types/domain/member-profile-types'
import type {OwnershipPeriod} from '@/services/types/domain/parcel-ownership-types'

import {
  TEST_MEMBER_PROFILES,
  TEST_PARCEL_OWNERSHIPS,
} from './tenant-member-profiles-seed'

const TECHCORP = 'techcorp-solutions'
const MARKETING = 'marketing-pro'
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const profilesOf = (slug: string) =>
  TEST_MEMBER_PROFILES.filter((row) => row.organizationSlug === slug)

const ownershipsOf = (slug: string) =>
  TEST_PARCEL_OWNERSHIPS.filter((row) => row.organizationSlug === slug)

const profileNamed = (slug: string, name: string) => {
  const profile = profilesOf(slug).find((row) => row.name === name)
  if (!profile) throw new Error(`Fiche de seed introuvable : ${name}`)
  return profile
}

const periodsOf = (slug: string, parcelNumber: string): OwnershipPeriod[] =>
  ownershipsOf(slug)
    .filter((row) => row.parcelNumber === parcelNumber)
    .map((row) => ({
      id: row.id,
      memberProfileId: row.memberProfileId,
      startsOn: row.startsOn,
      endsOn: row.endsOn,
    }))

const currentParcelsOf = (slug: string, memberProfileId: string) =>
  ownershipsOf(slug)
    .filter(
      (row) => row.memberProfileId === memberProfileId && row.endsOn === null
    )
    .map((row) => row.parcelNumber)

describe('seed des propriétaires et des parcelles (s12, ADR 029)', () => {
  it('donne à TechCorp une fiche qui possède deux parcelles (critère 5)', () => {
    const meunier = profileNamed(TECHCORP, 'Claire Meunier')

    expect(currentParcelsOf(TECHCORP, meunier.id)).toEqual(['12', '13'])
    expect(meunier.email).not.toBeNull()
  })

  it('donne à TechCorp une fiche courrier uniquement avec adresse, et une fiche incomplète (critères 7 et 8)', () => {
    const mailOnly = profilesOf(TECHCORP).filter((row) => row.email === null)
    const incomplete = mailOnly.filter((row) => isIncomplete(row))

    expect(mailOnly.length).toBeGreaterThanOrEqual(2)
    expect(incomplete.map((row) => row.name)).toEqual(['Hélène Roy'])
  })

  it('porte la parcelle 47 vendue : Dubois du 03/02/1998, puis Roy à partir du 15/06/2026 (critère 3)', () => {
    const dubois = profileNamed(TECHCORP, 'Jean et Odile Dubois')
    const roy = profileNamed(TECHCORP, 'Hélène Roy')
    const parcel47 = periodsOf(TECHCORP, '47')

    expect(parcel47).toEqual([
      expect.objectContaining({
        memberProfileId: dubois.id,
        startsOn: '1998-02-03',
        endsOn: '2026-06-15',
      }),
      expect.objectContaining({
        memberProfileId: roy.id,
        startsOn: '2026-06-15',
        endsOn: null,
      }),
    ])
    expect(ownerAt(parcel47, '2026-06-14')).toBe(dubois.id)
    expect(ownerAt(parcel47, '2026-06-15')).toBe(roy.id)
    expect(ownerAt(parcel47, '1998-02-02')).toBeUndefined()
  })

  it('donne à Marketing Pro ses propres fiches, dont une parcelle de même numéro que chez TechCorp', () => {
    const techcorpIds = profilesOf(TECHCORP).map((row) => row.id)
    const marketing = profilesOf(MARKETING)

    expect(marketing.length).toBeGreaterThan(0)
    expect(marketing.filter((row) => techcorpIds.includes(row.id))).toEqual([])
    expect(periodsOf(MARKETING, '47')).toHaveLength(1)
    expect(
      periodsOf(MARKETING, '47').filter((period) =>
        techcorpIds.includes(period.memberProfileId)
      )
    ).toEqual([])
  })

  it('ne rattache une période qu’à une fiche de la même association', () => {
    for (const ownership of TEST_PARCEL_OWNERSHIPS) {
      const owner = TEST_MEMBER_PROFILES.find(
        (row) => row.id === ownership.memberProfileId
      )
      expect(owner?.organizationSlug, ownership.id).toBe(
        ownership.organizationSlug
      )
    }
  })

  it('ne fait chevaucher aucune période d’une même parcelle, et respecte les bornes', () => {
    for (const slug of [TECHCORP, MARKETING]) {
      const numbers = new Set(ownershipsOf(slug).map((row) => row.parcelNumber))
      for (const number of numbers) {
        const periods = periodsOf(slug, number)
        for (const period of periods) {
          const others = periods.filter((other) => other.id !== period.id)
          expect(
            findOverlap(others, period),
            `${slug} ${number}`
          ).toBeUndefined()
          if (period.endsOn !== null) {
            expect(period.endsOn > period.startsOn).toBe(true)
          }
        }
      }
    }
  })

  it('est déterministe et fictif : identifiants fixes et uniques, emails en .test, aucune chaîne vide', () => {
    const ids = [
      ...TEST_MEMBER_PROFILES.map((row) => row.id),
      ...TEST_PARCEL_OWNERSHIPS.map((row) => row.id),
    ]
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(UUID)

    for (const profile of TEST_MEMBER_PROFILES) {
      expect(profile.name.trim()).toBe(profile.name)
      expect(profile.name.length).toBeLessThanOrEqual(
        MEMBER_PROFILE_NAME_MAX_LENGTH
      )
      for (const value of [
        profile.email,
        profile.phone,
        profile.addressLine,
        profile.addressComplement,
        profile.postalCode,
        profile.city,
      ]) {
        expect(value).not.toBe('')
      }
      if (profile.email !== null) {
        expect(profile.email).toMatch(/@[a-z0-9-]+\.test$/)
      }
      if (profile.postalCode !== null) {
        expect(profile.postalCode).toMatch(MEMBER_PROFILE_POSTAL_CODE_PATTERN)
      }
    }

    for (const slug of [TECHCORP, MARKETING]) {
      const emails = profilesOf(slug)
        .map((row) => row.email?.toLowerCase())
        .filter(Boolean)
      expect(new Set(emails).size, slug).toBe(emails.length)
    }
  })
})
