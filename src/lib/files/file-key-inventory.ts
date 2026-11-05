/**
 * Inventaire unique des cles de fichier referencees en base (s12c, ADR 045).
 *
 * La sauvegarde copie la base **et** `LOCAL_STORAGE_ROOT` ; le test de
 * restauration verifie qu'apres restauration toute cle listee ici designe un
 * fichier present. Une famille de fichiers absente de cet inventaire n'est donc
 * verifiee par rien : `src/db/file-key-inventory.test.ts` echoue sur toute
 * colonne `_key` du schema et sur toute propriete `...Key` d'un type de bloc
 * qui n'y serait pas declaree.
 *
 * Toute story qui stocke un fichier complete ce module dans le meme commit.
 */

/** Convention de nommage d'une colonne de cle de fichier. */
export const FILE_KEY_COLUMN_SUFFIX = '_key'

export type FileKeyColumn = {
  readonly table: string
  readonly column: string
}

/** Colonnes portant une cle de stockage, une cle par ligne au plus. */
export const FILE_KEY_COLUMNS: readonly FileKeyColumn[] = [
  {table: 'organization', column: 'identity_logo_key'},
  {table: 'organization', column: 'identity_favicon_key'},
  {table: 'page', column: 'share_image_key'},
  {table: 'news', column: 'image_key'},
  {table: 'board_member', column: 'photo_key'},
  {table: 'water_analysis', column: 'poster_key'},
  {table: 'water_analysis', column: 'report_key'},
]

/**
 * Cle de fichier logee dans une colonne `jsonb`, pour un type de bloc donne.
 * `path` suit les proprietes separees par des points ; `[]` parcourt un
 * tableau (`images[].fileKey` : chaque image d'une galerie).
 */
export type FileKeyJsonPath = {
  readonly table: string
  readonly column: string
  readonly typeColumn: string
  readonly blockType: string
  readonly path: string
}

/** Cles des blocs de page (ADR 019) : le nom d'une colonne ne les revele pas. */
export const FILE_KEY_JSON_PATHS: readonly FileKeyJsonPath[] = [
  {
    table: 'content_block',
    column: 'data',
    typeColumn: 'type',
    blockType: 'image',
    path: 'fileKey',
  },
  {
    table: 'content_block',
    column: 'data',
    typeColumn: 'type',
    blockType: 'pdf',
    path: 'fileKey',
  },
  {
    table: 'content_block',
    column: 'data',
    typeColumn: 'type',
    blockType: 'gallery',
    path: 'images[].fileKey',
  },
]

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const valuesAt = (value: unknown, segments: readonly string[]): unknown[] => {
  if (segments.length === 0) return [value]

  const [segment, ...rest] = segments
  const isArray = segment.endsWith('[]')
  const name = isArray ? segment.slice(0, -2) : segment
  if (!isRecord(value)) return []

  const child = value[name]
  if (!isArray) return valuesAt(child, rest)
  if (!Array.isArray(child)) return []
  return child.flatMap((item) => valuesAt(item, rest))
}

/** Les cles non vides trouvees a `path` dans la valeur JSON d'un bloc. */
export const fileKeysAtPath = (data: unknown, path: string): string[] =>
  valuesAt(data, path.split('.')).filter(
    (value): value is string => typeof value === 'string' && value !== ''
  )
