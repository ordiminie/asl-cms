import {PAGE_FILE_CONTENT_TYPES, PageFileFormat} from './page-block-types'

/**
 * Chaine de fichiers de contenu partagee (ADR 023, §3).
 *
 * Module isomorphe : il decrit les **portees** de fichiers de contenu (pages de
 * s04, actualites de s05 ; s06 et s09 y ajouteront la leur), construit leur cle
 * de stockage et verifie qu'une cle lue dans une requete vit sous une portee
 * enregistree de l'association resolue par le domaine.
 *
 * La validation par signature binaire et les plafonds de poids sont ceux de
 * s04, reexportes ici tels quels : une seule implementation.
 */
export type {
  PageFileFormat as ContentFileFormat,
  PageFileKind as ContentFileKind,
  PageFileValidation as ContentFileValidation,
} from './page-block-types'
export {
  PAGE_FILE_ACCEPTED_FORMATS as CONTENT_FILE_ACCEPTED_FORMATS,
  PAGE_FILE_CONTENT_TYPES as CONTENT_FILE_CONTENT_TYPES,
  PAGE_FILE_MAX_BYTES as CONTENT_FILE_MAX_BYTES,
  detectPageFileFormat as detectContentFileFormat,
  validatePageBlockFile as validateContentFile,
} from './page-block-types'

export const ContentFileScopeConst = {
  PAGES: 'pages',
  NEWS: 'news',
  /** Photos des fiches du bureau (s06). */
  BOARD: 'board',
} as const

export type ContentFileScope =
  (typeof ContentFileScopeConst)[keyof typeof ContentFileScopeConst]

export const CONTENT_FILE_SCOPES: readonly ContentFileScope[] = [
  ContentFileScopeConst.PAGES,
  ContentFileScopeConst.NEWS,
  ContentFileScopeConst.BOARD,
]

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * L'emplacement dans le proprietaire : l'identifiant d'un bloc de page, ou un
 * nom fixe choisi par le code (`image` pour une actualite). Jamais un nom
 * fourni par l'utilisateur.
 */
const SLOT_PATTERN = /^[0-9a-z]+(?:-[0-9a-z]+)*$/i
const SLOT_MAX_LENGTH = 64

/**
 * Cle de stockage generee par le serveur :
 * `{organizationId}/{portee}/{ownerId}/{slotId}-{uuid}.{ext}`.
 */
export const buildContentFileKey = (
  organizationId: string,
  scope: ContentFileScope,
  ownerId: string,
  slotId: string,
  format: PageFileFormat
): string => {
  if (!UUID_PATTERN.test(organizationId) || !UUID_PATTERN.test(ownerId)) {
    throw new Error('Invalid identifier for a content file key')
  }
  if (slotId.length > SLOT_MAX_LENGTH || !SLOT_PATTERN.test(slotId)) {
    throw new Error('Invalid slot for a content file key')
  }
  if (!CONTENT_FILE_SCOPES.includes(scope)) {
    throw new Error('Unknown content file scope')
  }

  return `${organizationId}/${scope}/${ownerId}/${slotId}-${crypto.randomUUID()}.${format}`
}

/** Le format servi, relu depuis l'extension d'une cle deja validee. */
export const getContentFileFormatFromKey = (
  key: string
): PageFileFormat | undefined => {
  const extension = key.split('.').pop()?.toLowerCase()
  return extension && extension in PAGE_FILE_CONTENT_TYPES
    ? (extension as PageFileFormat)
    : undefined
}

/**
 * Une cle lue dans une requete n'est servie que si elle vit sous une portee
 * enregistree (ou sous l'une de `scopes`) de l'association resolue par le
 * domaine, sans segment vide ni remontee de chemin, et avec une extension que
 * le produit sert.
 */
export const isContentFileKeyAllowed = (
  organizationId: string,
  key: string,
  scopes: readonly ContentFileScope[] = CONTENT_FILE_SCOPES
): boolean => {
  if (!UUID_PATTERN.test(organizationId)) return false

  const underScope = scopes.some((scope) =>
    key.startsWith(`${organizationId}/${scope}/`)
  )
  if (!underScope) return false

  const segments = key.split('/')
  if (segments.some((segment) => segment === '' || segment === '..')) {
    return false
  }
  if (key.includes('\0') || key.includes('\\')) return false

  return Boolean(getContentFileFormatFromKey(key))
}

/** Route publique de lecture des fichiers de contenu (ADR 023). */
export const CONTENT_FILE_ROUTE = '/api/files'

/**
 * Adresse publique d'un fichier de contenu, servie par la route de
 * l'application — jamais depuis `public/`.
 */
export const contentFileUrl = (key: string): string =>
  `${CONTENT_FILE_ROUTE}/${key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`
