import fs from 'node:fs'
import path from 'node:path'

import {describe, expect, it} from 'vitest'
import {z} from 'zod'

import {
  FILE_KEY_COLUMN_SUFFIX,
  FILE_KEY_COLUMNS,
  FILE_KEY_JSON_PATHS,
  type FileKeyColumn,
  type FileKeyJsonPath,
  fileKeysAtPath,
  NOT_FILE_KEY_COLUMNS,
} from '@/lib/files/file-key-inventory'
import {pageBlockSchema} from '@/services/types/domain/page-block-types'

/**
 * Garde d'inventaire des cles de fichier (s12c, ADR 045, criteres 3 et 4).
 *
 * La sauvegarde et le test de restauration ne valent que si l'inventaire est
 * complet : une famille de fichiers oubliee ici est une famille qu'aucun test
 * ne verifie apres restauration. Ce test lit donc le code, comme
 * `rls-inventory.test.ts` : les `pgTable` d'un cote, le schema Zod des blocs de
 * page de l'autre, et echoue sur toute derive dans les deux sens.
 *
 * Il vit hors de `src/db/models/` pour la meme raison que son precedent :
 * drizzle-kit charge ce dossier par `require` et casse sur un import de vitest.
 */

const ROOT = path.resolve(import.meta.dirname, '../..')
const MODELS_DIR = path.join(ROOT, 'src/db/models')

const sortColumns = (columns: FileKeyColumn[]): FileKeyColumn[] =>
  [...columns].sort((left, right) =>
    `${left.table}.${left.column}`.localeCompare(
      `${right.table}.${right.column}`
    )
  )

/**
 * Les colonnes declarees dans chaque `pgTable` d'une source de modele. Le corps
 * d'une table court jusqu'a la declaration `pgTable` suivante : un fichier en
 * porte parfois plusieurs (`auth-model.ts`).
 */
export const columnsIn = (source: string): FileKeyColumn[] => {
  const tables = [...source.matchAll(/pgTable\(\s*'([A-Za-z0-9_]+)'/g)]

  return sortColumns(
    tables.flatMap((match, index) => {
      const start = (match.index ?? 0) + match[0].length
      const end = tables[index + 1]?.index ?? source.length
      const body = source.slice(start, end)

      return [...body.matchAll(/\b[A-Za-z]+\(\s*'([A-Za-z0-9_]+)'/g)].map(
        (column) => ({table: match[1], column: column[1]})
      )
    })
  )
}

/** Les colonnes qui suivent la convention de nommage d'une cle de fichier. */
export const fileKeyColumnsIn = (source: string): FileKeyColumn[] =>
  columnsIn(source).filter(({column}) =>
    column.endsWith(FILE_KEY_COLUMN_SUFFIX)
  )

const sameColumn = (left: FileKeyColumn, right: FileKeyColumn) =>
  left.table === right.table && left.column === right.column

/** Les colonnes trouvees dans le schema mais absentes de l'inventaire. */
export const undeclaredColumns = (
  found: readonly FileKeyColumn[],
  declared: readonly FileKeyColumn[]
): FileKeyColumn[] =>
  found.filter((column) => !declared.some((entry) => sameColumn(entry, column)))

type SchemaDef = {
  type: string
  innerType?: z.ZodType
  element?: z.ZodType
  shape?: Record<string, z.ZodType>
  options?: z.ZodType[]
}

const defOf = (schema: z.ZodType): SchemaDef =>
  (schema as unknown as {_zod: {def: SchemaDef}})._zod.def

const WRAPPERS = new Set(['nullable', 'optional', 'default', 'prefault'])

/** Chemins des proprietes `...Key` d'un schema, `[]` marquant un tableau. */
const keyPathsIn = (schema: z.ZodType, prefix: string): string[] => {
  const def = defOf(schema)
  if (WRAPPERS.has(def.type) && def.innerType) {
    return keyPathsIn(def.innerType, prefix)
  }
  if (def.type === 'array' && def.element) {
    return keyPathsIn(def.element, `${prefix}[]`)
  }
  if (def.type !== 'object' || !def.shape) return []

  return Object.entries(def.shape).flatMap(([name, child]) => {
    const childPath = prefix ? `${prefix}.${name}` : name
    return name.endsWith('Key')
      ? [childPath, ...keyPathsIn(child, childPath)]
      : keyPathsIn(child, childPath)
  })
}

/**
 * Les cles de fichier portees par chaque type de bloc d'une union Zod
 * discriminee par `type`. Convention du JSON : une propriete dont le nom finit
 * par `Key` est une cle de fichier, comme une colonne `_key` en base.
 */
export const blockKeyPathsIn = (
  union: z.ZodType
): {blockType: string; path: string}[] =>
  (defOf(union).options ?? []).flatMap((option) => {
    const typeField = defOf(option).shape?.type
    const blockType = typeField
      ? String((defOf(typeField) as unknown as {values: unknown[]}).values[0])
      : ''

    return keyPathsIn(option, '')
      .filter((keyPath) => keyPath !== 'type')
      .map((keyPath) => ({blockType, path: keyPath}))
  })

const modelSources = (): string[] =>
  fs
    .readdirSync(MODELS_DIR)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .map((name) => fs.readFileSync(path.join(MODELS_DIR, name), 'utf8'))

const modelColumns = (): FileKeyColumn[] =>
  sortColumns(modelSources().flatMap((source) => columnsIn(source)))

const modelFileKeyColumns = (): FileKeyColumn[] =>
  sortColumns(modelSources().flatMap((source) => fileKeyColumnsIn(source)))

const jsonPathLabel = ({blockType, path: keyPath}: FileKeyJsonPath) =>
  `${blockType}:${keyPath}`

describe('extraction — les angles morts de la garde elle-même', () => {
  it('rattache chaque colonne à sa table quand un fichier en déclare plusieurs', () => {
    const source = `
      export const a = pgTable('organization', {
        id: uuid('id'),
        identityLogoKey: text('identity_logo_key'),
      })
      export const b = pgTable(
        'water_analysis',
        {posterKey: text('poster_key').notNull()}
      )
    `

    expect(fileKeyColumnsIn(source)).toEqual([
      {table: 'organization', column: 'identity_logo_key'},
      {table: 'water_analysis', column: 'poster_key'},
    ])
  })

  it('lit les tableaux, les nullables et les valeurs par défaut du schéma Zod', () => {
    const union = z.discriminatedUnion('type', [
      z.object({type: z.literal('text'), markdown: z.string()}),
      z.object({
        type: z.literal('image'),
        fileKey: z.string().nullable().default(null),
      }),
      z.object({
        type: z.literal('gallery'),
        images: z.array(z.object({fileKey: z.string()})).default([]),
      }),
    ])

    expect(blockKeyPathsIn(union)).toEqual([
      {blockType: 'image', path: 'fileKey'},
      {blockType: 'gallery', path: 'images[].fileKey'},
    ])
  })
})

describe('inventaire des colonnes de clé de fichier', () => {
  it('ne déclare que des colonnes qui existent dans un pgTable', () => {
    const columns = modelColumns()
    const missing = FILE_KEY_COLUMNS.filter(
      (entry) => !columns.some((column) => sameColumn(column, entry))
    )

    expect(missing).toEqual([])
  })

  it('déclare toute colonne `_key` du schéma, fichier ou exclusion explicite', () => {
    expect(
      undeclaredColumns(modelFileKeyColumns(), [
        ...FILE_KEY_COLUMNS,
        ...NOT_FILE_KEY_COLUMNS,
      ])
    ).toEqual([])
  })

  it('n’exclut que des colonnes `_key` qui existent dans un pgTable (ADR 052)', () => {
    const found = modelFileKeyColumns()
    const stale = NOT_FILE_KEY_COLUMNS.filter(
      (entry) => !found.some((column) => sameColumn(column, entry))
    )

    expect(stale).toEqual([])
    expect(NOT_FILE_KEY_COLUMNS).toContainEqual({
      table: 'scheduled_job',
      column: 'idempotency_key',
    })
  })

  it('une colonne n’est jamais à la fois fichier et exclue', () => {
    expect(
      FILE_KEY_COLUMNS.filter((entry) =>
        NOT_FILE_KEY_COLUMNS.some((excluded) => sameColumn(excluded, entry))
      )
    ).toEqual([])
  })

  it('l’exclusion ne couvre pas une autre colonne `_key` non déclarée', () => {
    const source = `
      export const t = pgTable('scheduled_job', {
        idempotencyKey: text('idempotency_key'),
        otherKey: text('other_key'),
      })
    `

    expect(
      undeclaredColumns(fileKeyColumnsIn(source), [
        ...FILE_KEY_COLUMNS,
        ...NOT_FILE_KEY_COLUMNS,
      ])
    ).toEqual([{table: 'scheduled_job', column: 'other_key'}])
  })

  // Critere 4 : la colonne de controle. Une colonne qui suit la convention,
  // ajoutee a une source de modele sans etre declaree, doit etre detectee.
  it('détecte une colonne de contrôle ajoutée sans être déclarée', () => {
    const controlSource = `
      export const news = pgTable('news', {
        imageKey: text('image_key'),
        attachmentKey: text('attachment_key'),
      })
    `

    expect(
      undeclaredColumns(fileKeyColumnsIn(controlSource), FILE_KEY_COLUMNS)
    ).toEqual([{table: 'news', column: 'attachment_key'}])
  })
})

describe('inventaire des chemins JSON des blocs de page', () => {
  it('déclare chaque clé de fichier portée par un type de bloc', () => {
    const declared = FILE_KEY_JSON_PATHS.map(jsonPathLabel).sort()
    const fromSchema = blockKeyPathsIn(pageBlockSchema)
      .map(({blockType, path: keyPath}) => `${blockType}:${keyPath}`)
      .sort()

    expect(declared).toEqual(fromSchema)
  })

  it('détecte un type de bloc de contrôle portant une clé non déclarée', () => {
    const controlUnion = z.discriminatedUnion('type', [
      ...pageBlockSchema.options,
      z.object({type: z.literal('video'), posterKey: z.string()}),
    ])
    const declared = FILE_KEY_JSON_PATHS.map(jsonPathLabel)
    const undeclared = blockKeyPathsIn(controlUnion)
      .map(({blockType, path: keyPath}) => `${blockType}:${keyPath}`)
      .filter((label) => !declared.includes(label))

    expect(undeclared).toEqual(['video:posterKey'])
  })

  it('pointe la colonne jsonb des blocs, qui existe', () => {
    const columns = modelColumns()
    const missing = FILE_KEY_JSON_PATHS.filter(
      (entry) => !columns.some((column) => sameColumn(column, entry))
    )

    expect(missing).toEqual([])
  })
})

describe('lecture des clés dans le JSON d’un bloc', () => {
  it('lit une clé simple, ignore une clé nulle', () => {
    expect(fileKeysAtPath({fileKey: 'org/pages/p/a.png'}, 'fileKey')).toEqual([
      'org/pages/p/a.png',
    ])
    expect(fileKeysAtPath({fileKey: null}, 'fileKey')).toEqual([])
  })

  it('lit chaque clé d’un tableau', () => {
    const data = {images: [{fileKey: 'k1'}, {fileKey: 'k2'}, {alt: ''}]}

    expect(fileKeysAtPath(data, 'images[].fileKey')).toEqual(['k1', 'k2'])
  })
})
