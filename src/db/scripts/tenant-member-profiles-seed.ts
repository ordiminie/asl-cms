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
 *
 * s12d : les fiches a adresse recoivent un compte au seed (critere 2). Lucie
 * Moreau a une parcelle actuelle et une ancienne (« Mes parcelles ») ; Gerard
 * Pommier a une fiche, et la meme adresse, dans les deux associations : un
 * seul compte, deux espaces (critere 3).
 *
 * s53 : Bernard Lefevre porte **trois fiches** chez TechCorp, une par client
 * Pennylane (deux a son nom, une « SCI Les Chenes »), toutes a la meme
 * adresse : un seul compte, relie a chacune au seed, et « Mes terrains »
 * en montre trois (parcelles 61, 62 et 63). C'est la seule adresse partagee
 * du seed.
 *
 * s54 (ADR 056) : `email` est l'adresse **titulaire** de la fiche,
 * `additionalEmails` ses adresses supplementaires, toutes actives. Paul
 * Ferrand porte deux adresses (la sienne et celle de sa fille) ; son adresse
 * est aussi supplementaire sur la fiche de Claire Meunier, titulaire d'une
 * fiche et supplementaire d'une autre (critere 8).
 *
 * s55 (ADR 058) : le domicile (`home…`) est l'adresse postale ; les Dubois
 * ont en plus un terrain distinct, Helene Roy un terrain **seul** (sa fiche
 * reste incomplete), et « SCI Les Chenes » porte un nom d'entreprise.
 *
 * s28 : Yvette Garnier porte **deux fiches sans email**, meme nom et meme
 * domicile, une par terrain (parcelles 71 et 72) : le courrier postal les
 * signale avant la generation, et le bureau choisit de les regrouper ou non.
 */
export type TestMemberProfile = {
  id: string
  organizationSlug: string
  name: string
  /** L'adresse titulaire ; `null` pour une fiche courrier uniquement. */
  email: string | null
  /** Les adresses supplementaires actives (s54). */
  additionalEmails?: readonly string[]
  phone: string | null
  /** Le domicile, adresse postale de la fiche (s55, ADR 058). */
  homeAddressLine: string | null
  homeAddressComplement: string | null
  homePostalCode: string | null
  homeCity: string | null
  /** Le terrain, propre a chaque fiche (s55). */
  landAddressLine: string | null
  landAddressComplement: string | null
  landPostalCode: string | null
  landCity: string | null
  companyName: string | null
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
const MOREAU_ID = 'a1200000-0000-4000-8000-000000000006'
const POMMIER_TECHCORP_ID = 'a1200000-0000-4000-8000-000000000007'
const SCI_PINS_ID = 'b1200000-0000-4000-8000-000000000001'
const FERREIRA_ID = 'b1200000-0000-4000-8000-000000000002'
const POMMIER_MARKETING_ID = 'b1200000-0000-4000-8000-000000000003'

const POMMIER_EMAIL = 'gerard.pommier@example.test'

const LEFEVRE_FIRST_ID = 'a1200000-0000-4000-8000-000000000008'
const LEFEVRE_SECOND_ID = 'a1200000-0000-4000-8000-000000000009'
const LEFEVRE_SCI_ID = 'a1200000-0000-4000-8000-00000000000a'
const LEFEVRE_EMAIL = 'bernard.lefevre@example.test'
const FERRAND_EMAIL = 'p.ferrand@techcorp-solutions.test'
const GARNIER_FIRST_ID = 'a1200000-0000-4000-8000-00000000000b'
const GARNIER_SECOND_ID = 'a1200000-0000-4000-8000-00000000000c'
const GARNIER_HOME = {
  homeAddressLine: '9 route du Moulin',
  homePostalCode: '33680',
  homeCity: 'Lacanau',
} as const

const NO_CONTACT = {
  email: null,
  phone: null,
  homeAddressLine: null,
  homeAddressComplement: null,
  homePostalCode: null,
  homeCity: null,
  landAddressLine: null,
  landAddressComplement: null,
  landPostalCode: null,
  landCity: null,
  companyName: null,
} as const

export const TEST_MEMBER_PROFILES: readonly TestMemberProfile[] = [
  {
    ...NO_CONTACT,
    id: MEUNIER_ID,
    organizationSlug: TECHCORP,
    name: 'Claire Meunier',
    email: 'claire.meunier@techcorp-solutions.test',
    additionalEmails: [FERRAND_EMAIL],
    homeAddressLine: '14 allée des Aulnes',
    homePostalCode: '33680',
    homeCity: 'Lacanau',
  },
  {
    ...NO_CONTACT,
    id: DUBOIS_ID,
    organizationSlug: TECHCORP,
    name: 'Jean et Odile Dubois',
    homeAddressLine: '8 chemin des Pins',
    homePostalCode: '33680',
    homeCity: 'Lacanau',
    landAddressLine: '11 allée des Arbousiers',
    landPostalCode: '33680',
    landCity: 'Lacanau',
  },
  {
    ...NO_CONTACT,
    id: ROY_ID,
    organizationSlug: TECHCORP,
    name: 'Hélène Roy',
    landAddressLine: '6 allée des Genêts',
    landPostalCode: '33680',
    landCity: 'Lacanau',
  },
  {
    ...NO_CONTACT,
    id: LAURENT_ID,
    organizationSlug: TECHCORP,
    name: 'Marcel Laurent',
    phone: '06 12 34 56 78',
    homeAddressLine: '3 rue du Lavoir',
    homePostalCode: '33680',
    homeCity: 'Lacanau',
  },
  {
    ...NO_CONTACT,
    id: FERRAND_ID,
    organizationSlug: TECHCORP,
    name: 'Paul Ferrand',
    email: FERRAND_EMAIL,
    additionalEmails: ['julie.ferrand@example.test'],
  },
  {
    ...NO_CONTACT,
    id: MOREAU_ID,
    organizationSlug: TECHCORP,
    name: 'Lucie Moreau',
    email: 'lucie.moreau@example.test',
    homeAddressLine: '5 impasse des Bruyères',
    homePostalCode: '33680',
    homeCity: 'Lacanau',
  },
  {
    ...NO_CONTACT,
    id: POMMIER_TECHCORP_ID,
    organizationSlug: TECHCORP,
    name: 'Gérard Pommier',
    email: POMMIER_EMAIL,
  },
  {
    ...NO_CONTACT,
    id: LEFEVRE_FIRST_ID,
    organizationSlug: TECHCORP,
    name: 'Bernard Lefèvre',
    email: LEFEVRE_EMAIL,
    homeAddressLine: '2 chemin des Chênes',
    homePostalCode: '33680',
    homeCity: 'Lacanau',
  },
  {
    ...NO_CONTACT,
    id: LEFEVRE_SECOND_ID,
    organizationSlug: TECHCORP,
    name: 'Bernard Lefèvre',
    email: LEFEVRE_EMAIL,
    homeAddressLine: '2 chemin des Chênes',
    homePostalCode: '33680',
    homeCity: 'Lacanau',
  },
  {
    ...NO_CONTACT,
    id: LEFEVRE_SCI_ID,
    organizationSlug: TECHCORP,
    name: 'SCI Les Chênes',
    companyName: 'SCI Les Chênes',
    email: LEFEVRE_EMAIL,
    homeAddressLine: '2 chemin des Chênes',
    homePostalCode: '33680',
    homeCity: 'Lacanau',
  },
  {
    ...NO_CONTACT,
    ...GARNIER_HOME,
    id: GARNIER_FIRST_ID,
    organizationSlug: TECHCORP,
    name: 'Yvette Garnier',
  },
  {
    ...NO_CONTACT,
    ...GARNIER_HOME,
    id: GARNIER_SECOND_ID,
    organizationSlug: TECHCORP,
    name: 'Yvette Garnier',
  },
  {
    ...NO_CONTACT,
    id: SCI_PINS_ID,
    organizationSlug: MARKETING,
    name: 'SCI Les Pins',
    email: 'contact@sci-les-pins.test',
    homeAddressLine: '1 place du Marché',
    homePostalCode: '40600',
    homeCity: 'Biscarrosse',
  },
  {
    ...NO_CONTACT,
    id: FERREIRA_ID,
    organizationSlug: MARKETING,
    name: 'Sophie Ferreira',
    homeAddressLine: '27 avenue des Dunes',
    homePostalCode: '40600',
    homeCity: 'Biscarrosse',
  },
  {
    ...NO_CONTACT,
    id: POMMIER_MARKETING_ID,
    organizationSlug: MARKETING,
    name: 'Gérard Pommier',
    email: POMMIER_EMAIL,
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
    id: 'a1200000-0000-4000-8000-0000000000a8',
    organizationSlug: TECHCORP,
    parcelNumber: '21',
    memberProfileId: MOREAU_ID,
    startsOn: '2011-04-02',
    endsOn: null,
  },
  {
    id: 'a1200000-0000-4000-8000-0000000000a9',
    organizationSlug: TECHCORP,
    parcelNumber: '9',
    memberProfileId: MOREAU_ID,
    startsOn: '2003-05-14',
    endsOn: '2019-10-01',
  },
  {
    id: 'a1200000-0000-4000-8000-0000000000aa',
    organizationSlug: TECHCORP,
    parcelNumber: '9',
    memberProfileId: LAURENT_ID,
    startsOn: '2019-10-01',
    endsOn: null,
  },
  {
    id: 'a1200000-0000-4000-8000-0000000000ab',
    organizationSlug: TECHCORP,
    parcelNumber: '33',
    memberProfileId: POMMIER_TECHCORP_ID,
    startsOn: '2016-08-22',
    endsOn: null,
  },
  {
    id: 'a1200000-0000-4000-8000-0000000000ac',
    organizationSlug: TECHCORP,
    parcelNumber: '61',
    memberProfileId: LEFEVRE_FIRST_ID,
    startsOn: '1998-02-03',
    endsOn: null,
  },
  {
    id: 'a1200000-0000-4000-8000-0000000000ad',
    organizationSlug: TECHCORP,
    parcelNumber: '62',
    memberProfileId: LEFEVRE_SECOND_ID,
    startsOn: '2004-06-01',
    endsOn: null,
  },
  {
    id: 'a1200000-0000-4000-8000-0000000000ae',
    organizationSlug: TECHCORP,
    parcelNumber: '63',
    memberProfileId: LEFEVRE_SCI_ID,
    startsOn: '2011-04-02',
    endsOn: null,
  },
  {
    id: 'a1200000-0000-4000-8000-0000000000af',
    organizationSlug: TECHCORP,
    parcelNumber: '71',
    memberProfileId: GARNIER_FIRST_ID,
    startsOn: '2008-03-01',
    endsOn: null,
  },
  {
    id: 'a1200000-0000-4000-8000-0000000000b0',
    organizationSlug: TECHCORP,
    parcelNumber: '72',
    memberProfileId: GARNIER_SECOND_ID,
    startsOn: '2017-09-15',
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
  {
    id: 'b1200000-0000-4000-8000-0000000000b3',
    organizationSlug: MARKETING,
    parcelNumber: '21',
    memberProfileId: POMMIER_MARKETING_ID,
    startsOn: '2018-03-15',
    endsOn: null,
  },
]
