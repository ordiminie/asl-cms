import {existsSync, readFileSync} from 'node:fs'
import path from 'node:path'

import ts from 'typescript'
import {describe, expect, it} from 'vitest'

const SRC_ROOT = path.resolve(import.meta.dirname, '../..')
const INTEGRATION = path.join(
  SRC_ROOT,
  'lib/better-auth/magic-link-integration.ts'
)
const AUTH = path.join(SRC_ROOT, 'lib/better-auth/auth.ts')

const CANDIDATE_SUFFIXES = ['.ts', '.tsx', '/index.ts', '/index.tsx']

/** Fichier de `src/` vise par un specifier, ou `undefined` (paquet, JSON). */
const resolveSpecifier = (from: string, specifier: string) => {
  const base = specifier.startsWith('@/')
    ? path.join(SRC_ROOT, specifier.slice(2))
    : specifier.startsWith('.')
      ? path.resolve(path.dirname(from), specifier)
      : undefined
  if (!base) return undefined
  return CANDIDATE_SUFFIXES.map((suffix) => `${base}${suffix}`).find(
    (candidate) => existsSync(candidate)
  )
}

const isTypeOnlyImport = (node: ts.ImportDeclaration) => {
  const clause = node.importClause
  if (!clause) return false
  if (clause.isTypeOnly) return true
  const bindings = clause.namedBindings
  return (
    !clause.name &&
    bindings !== undefined &&
    ts.isNamedImports(bindings) &&
    bindings.elements.length > 0 &&
    bindings.elements.every((element) => element.isTypeOnly)
  )
}

/**
 * Imports **statiques et evalues** d'un module : les imports de type sont
 * effaces a la compilation, et un `import()` dynamique ne s'evalue qu'a
 * l'appel. Ni l'un ni l'autre ne peut fermer un cycle au chargement.
 */
const staticImportsOf = (file: string): string[] => {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    false,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  return source.statements.flatMap((statement) => {
    if (ts.isImportDeclaration(statement) && !isTypeOnlyImport(statement)) {
      return [(statement.moduleSpecifier as ts.StringLiteral).text]
    }
    if (
      ts.isExportDeclaration(statement) &&
      !statement.isTypeOnly &&
      statement.moduleSpecifier
    ) {
      return [(statement.moduleSpecifier as ts.StringLiteral).text]
    }
    return []
  })
}

/** Tous les modules de `src/` charges, de proche en proche, par `entry`. */
const staticClosureOf = (entry: string): Set<string> => {
  const reached = new Set<string>()
  const pending = staticImportsOf(entry)
    .map((specifier) => resolveSpecifier(entry, specifier))
    .filter((file): file is string => Boolean(file))
  while (pending.length > 0) {
    const file = pending.pop() as string
    if (reached.has(file)) continue
    reached.add(file)
    for (const specifier of staticImportsOf(file)) {
      const target = resolveSpecifier(file, specifier)
      if (target && !reached.has(target)) pending.push(target)
    }
  }
  return reached
}

describe('graphe d’imports de l’intégration du lien magique', () => {
  it('le parcours suit bien les imports : auth.ts charge l’intégration', () => {
    expect(staticClosureOf(AUTH).has(INTEGRATION)).toBe(true)
  })

  it('ne remonte jamais vers auth.ts ni vers elle-même (aucun cycle au chargement)', () => {
    const closure = staticClosureOf(INTEGRATION)

    expect(closure.has(AUTH)).toBe(false)
    expect(closure.has(INTEGRATION)).toBe(false)
  })
})
