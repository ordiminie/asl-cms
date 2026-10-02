/**
 * Proprietaires, parcelles et periodes de propriete des tenants de test (s12,
 * ADR 029).
 *
 * Valeurs **fictives**, jamais celles d'un client. Les identifiants sont fixes
 * pour que le seed soit deterministe et rejouable ; une fiche creee par le
 * bureau recoit, elle, un UUID genere par la base.
 *
 * TechCorp porte les cas des criteres : une fiche a deux parcelles, une fiche
 * « courrier uniquement » avec adresse, une fiche incomplete, et **la parcelle
 * 47 vendue** (Dubois du 03/02/1998, Roy a partir du 15/06/2026 — periode
 * demi-ouverte : le jour de la vente appartient a l'acquereur). Marketing Pro
 * a ses propres fiches, dont une parcelle **de meme numero** : un numero n'est
 * unique que dans une association.
 */
export type TestMemberProfile = {
  id: string
  organizationSlug: string
  name: string
  email: string | null
  phone: string | null
  addressLine: string | null
  addressComplement: string | null
  postalCode: string | null
  city: string | null
}

export type TestParcelOwnership = {
  id: string
  organizationSlug: string
  parcelNumber: string
  memberProfileId: string
  startsOn: string
  endsOn: string | null
}

const TECHCORP = 'techcorp-solutions'
const MARKETING = 'marketing-pro'

const MEUNIER_ID = 'a1200000-0000-4000-8000-000000000001'
const DUBOIS_ID = 'a1200000-0000-4000-8000-000000000002'
const ROY_ID = 'a1200000-0000-4000-8000-000000000003'
const LAURENT_ID = 'a1200000-0000-4000-8000-000000000004'
const FERRAND_ID = 'a1200000-0000-4000-8000-000000000005'
const SCI_PINS_ID = 'b1200000-0000-4000-8000-000000000001'
const FERREIRA_ID = 'b1200000-0000-4000-8000-000000000002'

const NO_CONTACT = {
  email: null,
  phone: null,
  addressLine: null,
  addressComplement: null,
  postalCode: null,
  city: null,
} as const

export const TEST_MEMBER_PROFILES: readonly TestMemberProfile[] = [
  {
    ...NO_CONTACT,
    id: MEUNIER_ID,
    organizationSlug: TECHCORP,
    name: 'Claire Meunier',
    email: 'claire.meunier@techcorp-solutions.test',
    addressLine: '14 allée des Aulnes',
    postalCode: '33680',
    city: 'Lacanau',
  },
  {
    ...NO_CONTACT,
    id: DUBOIS_ID,
    organizationSlug: TECHCORP,
    name: 'Jean et Odile Dubois',
    addressLine: '8 chemin des Pins',
    postalCode: '33680',
    city: 'Lacanau',
  },
  {
    ...NO_CONTACT,
    id: ROY_ID,
    organizationSlug: TECHCORP,
    name: 'Hélène Roy',
  },
  {
    ...NO_CONTACT,
    id: LAURENT_ID,
    organizationSlug: TECHCORP,
    name: 'Marcel Laurent',
    phone: '06 12 34 56 78',
    addressLine: '3 rue du Lavoir',
    postalCode: '33680',
    city: 'Lacanau',
  },
  {
    ...NO_CONTACT,
    id: FERRAND_ID,
    organizationSlug: TECHCORP,
    name: 'Paul Ferrand',
    email: 'p.ferrand@techcorp-solutions.test',
  },
  {
    ...NO_CONTACT,
    id: SCI_PINS_ID,
    organizationSlug: MARKETING,
    name: 'SCI Les Pins',
    email: 'contact@sci-les-pins.test',
    addressLine: '1 place du Marché',
    postalCode: '40600',
    city: 'Biscarrosse',
  },
  {
    ...NO_CONTACT,
    id: FERREIRA_ID,
    organizationSlug: MARKETING,
    name: 'Sophie Ferreira',
    addressLine: '27 avenue des Dunes',
    postalCode: '40600',
    city: 'Biscarrosse',
  },
]

export const TEST_PARCEL_OWNERSHIPS: readonly TestParcelOwnership[] = [
  {
    id: 'a1200000-0000-4000-8000-0000000000a1',
    organizationSlug: TECHCORP,
    parcelNumber: '12',
    memberProfileId: MEUNIER_ID,
    startsOn: '1998-02-03',
    endsOn: null,
  },
  {
    id: 'a1200000-0000-4000-8000-0000000000a2',
    organizationSlug: TECHCORP,
    parcelNumber: '13',
    memberProfileId: MEUNIER_ID,
    startsOn: '2009-09-11',
    endsOn: null,
  },
  {
    id: 'a1200000-0000-4000-8000-0000000000a3',
    organizationSlug: TECHCORP,
    parcelNumber: '47',
    memberProfileId: DUBOIS_ID,
    startsOn: '1998-02-03',
    endsOn: '2026-06-15',
  },
  {
    id: 'a1200000-0000-4000-8000-0000000000a4',
    organizationSlug: TECHCORP,
    parcelNumber: '47',
    memberProfileId: ROY_ID,
    startsOn: '2026-06-15',
    endsOn: null,
  },
  {
    id: 'a1200000-0000-4000-8000-0000000000a5',
    organizationSlug: TECHCORP,
    parcelNumber: '5',
    memberProfileId: LAURENT_ID,
    startsOn: '2001-07-20',
    endsOn: null,
  },
  {
    id: 'a1200000-0000-4000-8000-0000000000a6',
    organizationSlug: TECHCORP,
    parcelNumber: '6',
    memberProfileId: LAURENT_ID,
    startsOn: '2001-07-20',
    endsOn: null,
  },
  {
    id: 'a1200000-0000-4000-8000-0000000000a7',
    organizationSlug: TECHCORP,
    parcelNumber: '30',
    memberProfileId: LAURENT_ID,
    startsOn: '2014-05-12',
    endsOn: null,
  },
  {
    id: 'b1200000-0000-4000-8000-0000000000b1',
    organizationSlug: MARKETING,
    parcelNumber: '47',
    memberProfileId: SCI_PINS_ID,
    startsOn: '2015-04-01',
    endsOn: null,
  },
  {
    id: 'b1200000-0000-4000-8000-0000000000b2',
    organizationSlug: MARKETING,
    parcelNumber: '8',
    memberProfileId: FERREIRA_ID,
    startsOn: '2019-10-07',
    endsOn: null,
  },
]
