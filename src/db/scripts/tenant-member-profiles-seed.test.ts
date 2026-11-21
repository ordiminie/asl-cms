import {describe, expect, it} from 'vitest'

import {homonymGroupsOf} from '@/services/rules/campaign-letter-rules'
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
/** Le compte à trois fiches de s53 : la seule adresse partagée du seed. */
const LEFEVRE_EMAIL = 'bernard.lefevre@example.test'
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
    const incomplete = mailOnly.filter((row) =>
      isIncomplete({...row, mailOnly: true})
    )

    expect(mailOnly.length).toBeGreaterThanOrEqual(2)
    expect(incomplete.map((row) => row.name)).toEqual(['Hélène Roy'])
  })

  it('donne à TechCorp deux fiches sans email de même nom et même domicile, sur deux parcelles (s28, critère 2)', () => {
    const mailOnly = profilesOf(TECHCORP).filter((row) => row.email === null)
    const groups = homonymGroupsOf(
      mailOnly.map((row) => ({...row, id: row.id}))
    )

    expect(groups).toHaveLength(1)
    const [first, second] = groups[0]
    expect(groups[0]).toHaveLength(2)
    expect(first.id).not.toBe(second.id)
    expect(currentParcelsOf(TECHCORP, first.id)).toHaveLength(1)
    expect(currentParcelsOf(TECHCORP, second.id)).toHaveLength(1)
    expect(currentParcelsOf(TECHCORP, first.id)).not.toEqual(
      currentParcelsOf(TECHCORP, second.id)
    )
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
        profile.homeAddressLine,
        profile.homeAddressComplement,
        profile.homePostalCode,
        profile.homeCity,
        profile.landAddressLine,
        profile.landAddressComplement,
        profile.landPostalCode,
        profile.landCity,
        profile.companyName,
      ]) {
        expect(value).not.toBe('')
      }
      if (profile.email !== null) {
        expect(profile.email).toMatch(/@[a-z0-9-]+\.test$/)
      }
      for (const postalCode of [
        profile.homePostalCode,
        profile.landPostalCode,
      ]) {
        if (postalCode !== null) {
          expect(postalCode).toMatch(MEMBER_PROFILE_POSTAL_CODE_PATTERN)
        }
      }
    }

    const sharedEmailsOf = (slug: string) => {
      const emails = profilesOf(slug)
        .map((row) => row.email?.toLowerCase())
        .filter((email): email is string => Boolean(email))
      return [
        ...new Set(
          emails.filter(
            (email) => emails.indexOf(email) !== emails.lastIndexOf(email)
          )
        ),
      ]
    }
    expect(sharedEmailsOf(TECHCORP)).toEqual([LEFEVRE_EMAIL])
    expect(sharedEmailsOf(MARKETING)).toEqual([])
  })

  it('donne à TechCorp une propriétaire à adresse avec une parcelle actuelle et une ancienne (s12d, écran C2)', () => {
    const moreau = profileNamed(TECHCORP, 'Lucie Moreau')
    const former = ownershipsOf(TECHCORP).filter(
      (row) => row.memberProfileId === moreau.id && row.endsOn !== null
    )

    expect(moreau.email).not.toBeNull()
    expect(currentParcelsOf(TECHCORP, moreau.id)).toHaveLength(1)
    expect(former).toHaveLength(1)
  })

  it('porte une même adresse sur deux associations, avec une parcelle dans chacune (s12d, critère 3)', () => {
    const atTechcorp = profileNamed(TECHCORP, 'Gérard Pommier')
    const atMarketing = profileNamed(MARKETING, 'Gérard Pommier')

    expect(atTechcorp.email).not.toBeNull()
    expect(atTechcorp.email?.toLowerCase()).toBe(
      atMarketing.email?.toLowerCase()
    )
    expect(atTechcorp.id).not.toBe(atMarketing.id)
    expect(currentParcelsOf(TECHCORP, atTechcorp.id)).toHaveLength(1)
    expect(currentParcelsOf(MARKETING, atMarketing.id)).toHaveLength(1)
  })

  it('porte dans TechCorp un compte à trois fiches : même adresse, une parcelle actuelle chacune (s53, critères 1 et 2)', () => {
    const shared = profilesOf(TECHCORP).filter(
      (row) => row.email?.toLowerCase() === LEFEVRE_EMAIL
    )

    expect(shared).toHaveLength(3)
    expect(new Set(shared.map((row) => row.id)).size).toBe(3)
    expect(shared.map((row) => row.name)).toContain('SCI Les Chênes')
    expect(shared.map((row) => currentParcelsOf(TECHCORP, row.id))).toEqual([
      ['61'],
      ['62'],
      ['63'],
    ])
  })
})

/**
 * s54 (ADR 056) : une fiche a plusieurs adresses actives, chacune avec un
 * role propre a la fiche.
 */
describe('seed du domicile, du terrain et du nom de l’entreprise (s55, ADR 058)', () => {
  it('donne à TechCorp une fiche incomplète qui ne porte que son terrain : le terrain seul ne suffit pas', () => {
    const roy = profileNamed(TECHCORP, 'Hélène Roy')

    expect(roy.homeAddressLine).toBeNull()
    expect(roy.landAddressLine).not.toBeNull()
    expect(roy.landCity).not.toBeNull()
    expect(isIncomplete({...roy, mailOnly: true})).toBe(true)
  })

  it('donne à TechCorp une fiche à domicile et terrain distincts, et une fiche d’entreprise', () => {
    const dubois = profileNamed(TECHCORP, 'Jean et Odile Dubois')
    expect(dubois.homeAddressLine).not.toBeNull()
    expect(dubois.landAddressLine).not.toBeNull()
    expect(dubois.landAddressLine).not.toBe(dubois.homeAddressLine)

    const companies = profilesOf(TECHCORP).filter(
      (row) => row.companyName !== null
    )
    expect(companies.map((row) => row.name)).toEqual(['SCI Les Chênes'])
  })
})

describe('seed des adresses multiples (s54)', () => {
  const FERRAND_EMAIL = 'p.ferrand@techcorp-solutions.test'

  it('donne à TechCorp une fiche à deux adresses actives, une titulaire et une supplémentaire', () => {
    const ferrand = profileNamed(TECHCORP, 'Paul Ferrand')

    expect(ferrand.email).toBe(FERRAND_EMAIL)
    expect(ferrand.additionalEmails).toEqual(['julie.ferrand@example.test'])
  })

  it('porte une adresse titulaire d’une fiche et supplémentaire d’une autre (critère 8)', () => {
    const meunier = profileNamed(TECHCORP, 'Claire Meunier')

    expect(meunier.email).not.toBe(FERRAND_EMAIL)
    expect(meunier.additionalEmails).toEqual([FERRAND_EMAIL])
  })

  it('n’écrit que des adresses fictives en .test, jamais deux fois sur une fiche', () => {
    for (const profile of TEST_MEMBER_PROFILES) {
      const all = [profile.email, ...(profile.additionalEmails ?? [])]
        .filter((email): email is string => Boolean(email))
        .map((email) => email.toLowerCase())
      expect(new Set(all).size).toBe(all.length)
      for (const email of all) expect(email).toMatch(/@[a-z0-9-]+\.test$/)
    }
  })
})
