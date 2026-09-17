import type {OrganizationIdentityKindModel} from '@/db/models/organization-model'

/**
 * Fichiers d'identite d'une association : logo et favicon (ADR 015).
 *
 * Module isomorphe : les regles pures servent au service, a la route de
 * lecture et a l'interface (monogramme), sans aucune dependance serveur.
 */
export type AssociationIdentityKind = OrganizationIdentityKindModel

export const AssociationIdentityKindConst = {
  LOGO: 'logo',
  FAVICON: 'favicon',
} as const satisfies Record<string, AssociationIdentityKind>

export const ASSOCIATION_IDENTITY_KINDS = [
  AssociationIdentityKindConst.LOGO,
  AssociationIdentityKindConst.FAVICON,
] as const

/** Formats acceptes a l'ecriture, donc les seuls jamais servis. */
export type AssociationIdentityFormat = 'png' | 'webp' | 'ico'

/** Formats reconnus par leur signature, acceptes ou non. */
export type DetectedFileFormat =
  AssociationIdentityFormat | 'jpeg' | 'gif' | 'svg'

export const IDENTITY_ACCEPTED_FORMATS: Record<
  AssociationIdentityKind,
  readonly AssociationIdentityFormat[]
> = {
  logo: ['png', 'webp'],
  favicon: ['png', 'ico'],
}

/** Poids maximal par type de fichier, en octets. */
export const IDENTITY_MAX_BYTES: Record<AssociationIdentityKind, number> = {
  logo: 1024 * 1024,
  favicon: 200 * 1024,
}

export const IDENTITY_FORMAT_CONTENT_TYPES: Record<
  AssociationIdentityFormat,
  string
> = {
  png: 'image/png',
  webp: 'image/webp',
  ico: 'image/x-icon',
}

export type AssociationIdentityValidation =
  | {valid: true; format: AssociationIdentityFormat}
  | {valid: false; reason: 'format'; detectedFormat?: DetectedFileFormat}
  | {valid: false; reason: 'size'; size: number; maxBytes: number}

const startsWith = (content: Uint8Array, signature: number[], offset = 0) =>
  content.length >= offset + signature.length &&
  signature.every((value, index) => content[offset + index] === value)

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46]
const WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50]
const ICO_SIGNATURE = [0x00, 0x00, 0x01, 0x00]
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff]
const GIF_SIGNATURE = [0x47, 0x49, 0x46, 0x38]

const looksLikeSvg = (content: Uint8Array) => {
  const head = new TextDecoder()
    .decode(content.slice(0, 512))
    .replace(/^﻿/, '')
    .trimStart()
    .toLowerCase()
  return head.startsWith('<?xml') || head.startsWith('<svg')
}

/**
 * Detecte le format d'un fichier par sa signature binaire, jamais par son nom
 * ni par le type declare par le navigateur.
 */
export const detectIdentityFileFormat = (
  content: Uint8Array
): DetectedFileFormat | undefined => {
  if (startsWith(content, PNG_SIGNATURE)) return 'png'
  if (
    startsWith(content, RIFF_SIGNATURE) &&
    startsWith(content, WEBP_SIGNATURE, 8)
  ) {
    return 'webp'
  }
  if (startsWith(content, ICO_SIGNATURE)) return 'ico'
  if (startsWith(content, JPEG_SIGNATURE)) return 'jpeg'
  if (startsWith(content, GIF_SIGNATURE)) return 'gif'
  if (looksLikeSvg(content)) return 'svg'
  return undefined
}

const isAcceptedFormat = (
  kind: AssociationIdentityKind,
  format: DetectedFileFormat | undefined
): format is AssociationIdentityFormat =>
  (IDENTITY_ACCEPTED_FORMATS[kind] as readonly string[]).includes(format ?? '')

/** Valide le poids puis le format d'un fichier d'identite. */
export const validateAssociationIdentityFile = (
  kind: AssociationIdentityKind,
  content: Uint8Array
): AssociationIdentityValidation => {
  const maxBytes = IDENTITY_MAX_BYTES[kind]
  if (content.length > maxBytes) {
    return {valid: false, reason: 'size', size: content.length, maxBytes}
  }

  const detectedFormat = detectIdentityFileFormat(content)
  if (!isAcceptedFormat(kind, detectedFormat)) {
    return {valid: false, reason: 'format', detectedFormat}
  }

  return {valid: true, format: detectedFormat}
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Cle de stockage generee par le serveur (ADR 015) :
 * `{organizationId}/identity/{logo|favicon}-{uuid}.{png|webp|ico}`.
 * Aucun nom fourni par l'utilisateur n'y entre.
 */
export const buildAssociationIdentityKey = (
  organizationId: string,
  kind: AssociationIdentityKind,
  format: AssociationIdentityFormat
): string => {
  if (!UUID_PATTERN.test(organizationId)) {
    throw new Error('Invalid organization id for an identity key')
  }
  return `${organizationId}/identity/${kind}-${crypto.randomUUID()}.${format}`
}

/** Le format valide a l'ecriture, relu depuis l'extension de la cle. */
export const getIdentityFormatFromKey = (
  key: string
): AssociationIdentityFormat | undefined => {
  const extension = key.split('.').pop()?.toLowerCase()
  return extension && extension in IDENTITY_FORMAT_CONTENT_TYPES
    ? (extension as AssociationIdentityFormat)
    : undefined
}

const firstLetter = (word: string) => Array.from(word)[0] ?? ''

/**
 * Monogramme de l'association : initiales des deux premiers mots du nom, en
 * ignorant un prefixe « ASL » en tete ; un seul mot donne ses deux premieres
 * lettres. En capitales. « La Fourche » → LF, « ASL Les Pins » → LP.
 */
export const getAssociationMonogram = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const significant =
    words.length > 1 && words[0].toUpperCase() === 'ASL'
      ? words.slice(1)
      : words

  const monogram =
    significant.length >= 2
      ? firstLetter(significant[0]) + firstLetter(significant[1])
      : Array.from(significant[0] ?? '')
          .slice(0, 2)
          .join('')

  return monogram.toLocaleUpperCase('fr')
}

/**
 * Version d'un fichier d'identite, tiree de sa cle (ADR 015) : l'identifiant
 * unique du fichier. Sert de parametre `?v=` aux adresses de la route.
 */
export const getIdentityVersionFromKey = (
  key: string | null | undefined
): string | undefined => {
  const fileName = key?.split('/').pop()
  const match = fileName?.match(/^(?:logo|favicon)-(.+)\.[a-z]+$/)
  return match?.[1]
}

/** Libelles des formats, tels qu'affiches dans les messages. */
export const DETECTED_FORMAT_LABELS: Record<DetectedFileFormat, string> = {
  png: 'PNG',
  webp: 'WebP',
  ico: 'ICO',
  jpeg: 'JPEG',
  gif: 'GIF',
  svg: 'SVG',
}

export type FileSizeDescription = {
  unit: 'megabytes' | 'kilobytes'
  value: number
}

/** Poids lisible : en Mo a partir de 1 Mo, en Ko en dessous, a 0,1 pres. */
export const describeFileSize = (bytes: number): FileSizeDescription => {
  const megabyte = 1024 * 1024
  return bytes >= megabyte
    ? {unit: 'megabytes', value: Math.round((bytes / megabyte) * 10) / 10}
    : {unit: 'kilobytes', value: Math.round((bytes / 1024) * 10) / 10}
}
