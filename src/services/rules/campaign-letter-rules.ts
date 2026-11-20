import {
  CampaignLetterAddressSource,
  CampaignLetterGrouping,
  CampaignNature,
  DEFAULT_CAMPAIGN_NATURE,
} from '../types/domain/campaign-types'
import {
  CampaignTargetPredicate,
  CampaignTargetRow,
  computeCampaignTarget,
  joinParcelNumbers,
  sameAddressRowsOf,
} from './campaign-rules'

/**
 * Regles pures du courrier postal (s28, ADR 065 et 067). Aucun acces a la
 * base, aucune horloge : le service les appelle a la creation de la campagne
 * (canaux) et a la generation du PDF (adresses, homonymes, lettres).
 */

/** Le canal de chaque fiche ciblee : email, courrier, ou refus de l'envoi. */
export type CampaignChannels = {
  emailProfileIds: string[]
  letterProfileIds: string[]
  /**
   * Fiches dont toutes les adresses sont exclues d'un envoi facultatif : leur
   * refus porte sur l'envoi, pas sur le canal (ADR 065 §3).
   */
  refusedProfileIds: string[]
}

/**
 * La partition des fiches ciblees (critere 6) : couvertes par un destinataire
 * email (les fiches de son adresse, comme `campaign_recipient_profile`), sans
 * adresse active (le courrier), ou refusees. Les memes lignes et le meme
 * calcul que `computeCampaignTarget` : jamais une seconde definition.
 */
export const campaignChannelsOf = <Row extends CampaignTargetRow>(
  rows: readonly Row[],
  isTargeted: CampaignTargetPredicate = () => true,
  nature: CampaignNature = DEFAULT_CAMPAIGN_NATURE
): CampaignChannels => {
  const target = computeCampaignTarget(rows, isTargeted, nature)
  const covered = new Set(
    target.recipients.flatMap((recipient) =>
      sameAddressRowsOf(rows, recipient, isTargeted).map(
        (sibling) => sibling.memberProfileId
      )
    )
  )
  const withEmail = new Set(
    rows
      .filter((row) => row.email && isTargeted(row))
      .map((row) => row.memberProfileId)
  )
  return {
    emailProfileIds: [...covered],
    letterProfileIds: target.withoutEmailProfileIds.filter(
      (id) => !withEmail.has(id)
    ),
    refusedProfileIds: [...withEmail].filter((id) => !covered.has(id)),
  }
}

/** Ce que le courrier lit d'une fiche : nom, libelle, domicile, terrain. */
export type LetterProfile = {
  id: string
  name: string
  companyName: string | null
  homeAddressLine: string | null
  homeAddressComplement: string | null
  homePostalCode: string | null
  homeCity: string | null
  landAddressLine: string | null
  landAddressComplement: string | null
  landPostalCode: string | null
  landCity: string | null
}

export type LetterAddress = {
  source: CampaignLetterAddressSource
  lines: string[]
}

/** Lignes du bloc adresse au plus (design system §6.1, ADR 067 §2). */
export const LETTER_ADDRESS_MAX_LINES = 4

const textOf = (value: string | null): string => value?.trim() ?? ''

const comparableOf = (value: string): string =>
  value.toLowerCase().replace(/\s+/g, ' ').trim()

type PostalAddress = {
  line: string
  complement: string
  postalCode: string
  city: string
}

const postalAddressOf = (
  line: string | null,
  complement: string | null,
  postalCode: string | null,
  city: string | null
): PostalAddress | null => {
  const address = {
    line: textOf(line),
    complement: textOf(complement),
    postalCode: textOf(postalCode),
    city: textOf(city),
  }
  return address.line || address.postalCode || address.city ? address : null
}

const addressLinesOf = (head: string[], address: PostalAddress): string[] => {
  const locality = [address.postalCode, address.city].filter(Boolean).join(' ')
  const separate = [...head, address.line, address.complement, locality].filter(
    Boolean
  )
  if (separate.length <= LETTER_ADDRESS_MAX_LINES || !address.line) {
    return separate
  }
  const merged = address.complement
    ? `${address.line}, ${address.complement}`
    : address.line
  return [...head, merged, locality].filter(Boolean)
}

/**
 * Le bloc adresse d'une fiche (ADR 067 §1-2) : le domicile, a defaut le
 * terrain, a defaut le nom seul. Nom · libelle d'entreprise s'il differe du
 * nom · ligne · complement (fusionne a la ligne si le bloc depasserait 4
 * lignes) · code postal et ville. Une ligne vide est omise.
 */
export const letterAddressLinesOf = (profile: LetterProfile): LetterAddress => {
  const name = textOf(profile.name)
  const company = textOf(profile.companyName)
  const head =
    company && comparableOf(company) !== comparableOf(name)
      ? [name, company]
      : [name]
  const home = postalAddressOf(
    profile.homeAddressLine,
    profile.homeAddressComplement,
    profile.homePostalCode,
    profile.homeCity
  )
  if (home) return {source: 'home', lines: addressLinesOf(head, home)}
  const land = postalAddressOf(
    profile.landAddressLine,
    profile.landAddressComplement,
    profile.landPostalCode,
    profile.landCity
  )
  if (land) return {source: 'land', lines: addressLinesOf(head, land)}
  return {source: 'name_only', lines: [name]}
}

/**
 * La cle « meme nom et meme domicile » (s13, s55, ADR 067 §5) : nom, ligne
 * d'adresse et code postal du domicile, en minuscules, espaces compactes. La
 * seule definition, partagee par l'import et le courrier.
 */
export const sameNameAndHomeKeyOf = (
  name: string,
  homeAddressLine: string | null | undefined,
  homePostalCode: string | null | undefined
): string =>
  [name, homeAddressLine ?? '', homePostalCode ?? '']
    .map(comparableOf)
    .join('|')

const homonymKeyOf = (profile: LetterProfile): string | null =>
  textOf(profile.homeAddressLine)
    ? sameNameAndHomeKeyOf(
        profile.name,
        profile.homeAddressLine,
        profile.homePostalCode
      )
    : null

/**
 * Les fiches de meme nom et meme domicile, par groupes de deux au moins, dans
 * l'ordre des fiches recues. Une fiche sans domicile n'est jamais regroupee.
 */
export const homonymGroupsOf = <Profile extends LetterProfile>(
  profiles: readonly Profile[]
): Profile[][] => {
  const groups = new Map<string, Profile[]>()
  for (const profile of profiles) {
    const key = homonymKeyOf(profile)
    if (key) groups.set(key, [...(groups.get(key) ?? []), profile])
  }
  return [...groups.values()].filter((group) => group.length > 1)
}

/** Une lettre du lot : une fiche, ou un groupe d'homonymes regroupe. */
export type CampaignLetter = {
  memberProfileIds: string[]
  name: string
  address: LetterAddress
  /** La valeur de `{parcelle}` : les parcelles actuelles, en ordre numerique. */
  parcelle: string
}

const byNumber = (a: string, b: string): number =>
  a.localeCompare(b, 'fr', {numeric: true})

const sortedParcelsOf = (
  profiles: readonly LetterProfile[],
  parcels: Readonly<Record<string, readonly string[]>>
): string[] =>
  profiles.flatMap((profile) => parcels[profile.id] ?? []).sort(byNumber)

const letterOf = (
  profiles: readonly LetterProfile[],
  parcels: Readonly<Record<string, readonly string[]>>
): CampaignLetter => ({
  memberProfileIds: profiles.map((profile) => profile.id),
  name: profiles[0].name,
  address: letterAddressLinesOf(profiles[0]),
  parcelle: joinParcelNumbers(sortedParcelsOf(profiles, parcels)),
})

/** Ordre de mise sous pli (§6.3) : par nom, puis premiere parcelle, puis id. */
const compareLetters =
  (parcels: Readonly<Record<string, readonly string[]>>) =>
  (a: LetterProfile, b: LetterProfile): number =>
    a.name.localeCompare(b.name, 'fr', {sensitivity: 'base'}) ||
    byNumber(
      sortedParcelsOf([a], parcels)[0] ?? '',
      sortedParcelsOf([b], parcels)[0] ?? ''
    ) ||
    a.id.localeCompare(b.id)

/**
 * Les lettres du lot (criteres 1 et 2), triees par nom : une par fiche, ou,
 * « une seule lettre par personne », une par groupe d'homonymes, qui cite
 * toutes les parcelles du groupe.
 */
export const lettersOf = (
  profiles: readonly LetterProfile[],
  grouping: CampaignLetterGrouping,
  parcels: Readonly<Record<string, readonly string[]>>
): CampaignLetter[] => {
  const sorted = [...profiles].sort(compareLetters(parcels))
  if (grouping === 'per_land') {
    return sorted.map((profile) => letterOf([profile], parcels))
  }
  const groupOf = new Map<string, LetterProfile[]>()
  for (const group of homonymGroupsOf(sorted)) {
    for (const profile of group) groupOf.set(profile.id, group)
  }
  const written = new Set<string>()
  return sorted.flatMap((profile) => {
    if (written.has(profile.id)) return []
    const group = groupOf.get(profile.id) ?? [profile]
    for (const member of group) written.add(member.id)
    return [letterOf(group, parcels)]
  })
}
