#!/usr/bin/env tsx

import fs from 'node:fs'
import path from 'node:path'

/**
 * Garde-fou d'alignement des règles.
 *
 * Les règles et la documentation ne cassent pas le build : elles dérivent en
 * silence, et un agent suit la version périmée sans que rien ne le signale.
 * Ce script attrape les dérives qui laissent une trace.
 *
 * `pnpm check:rules` vérifie, `pnpm check:rules --fix` régénère les copies
 * Cursor à partir des règles Claude, qui font foi.
 */

const CLAUDE_RULES = '.claude/rules'
const CURSOR_RULES = '.cursor/rules'

/**
 * Termes rendus faux par un changement d'architecture. Après chaque migration,
 * ajouter ici ce que le changement périme : c'est le seul contrôle qui attrape
 * une règle juste sur la forme mais fausse sur le fond.
 */
const STALE_PATTERNS: {pattern: RegExp; why: string; allow?: RegExp}[] = [
  {
    pattern: /react-cache|React cache/,
    why: "le cache est porté par la fonction du DAL ('use cache'), plus par react-cache",
    // le nom du fichier de règle contient le terme
    allow: /rule-react-cache-next-cache/,
  },
  {
    pattern: /experimental\.useCache/,
    why: 'retiré en Next 16, remplacé par cacheComponents',
    allow: /Remplace|Replaces/,
  },
  {
    pattern: /force-static|dynamicParams/,
    why: 'route segment configs incompatibles avec Cache Components',
  },
  {
    pattern: /src\/middleware/,
    why: "ce fichier n'a jamais existé : le gating est dans src/proxy.ts",
  },
]

const DESCRIBE_THE_CODE = [
  'CLAUDE.md',
  'AGENTS.md',
  'README.md',
  CLAUDE_RULES,
  CURSOR_RULES,
  'src/app/[locale]/docs/_files',
]

const failures: string[] = []
const fail = (where: string, what: string) =>
  failures.push(`${where}\n    ${what}`)

const walk = (dir: string, ext: string): string[] => {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return walk(full, ext)
    return entry.name.endsWith(ext) ? [full] : []
  })
}

const stripFrontmatter = (text: string) =>
  text.replace(/^---\n[\s\S]*?\n---\n/, '')

const frontmatterOf = (text: string) => {
  const match = text.match(/^---\n[\s\S]*?\n---\n/)
  return match
    ? match[0]
    : '---\ndescription:\nglobs:\nalwaysApply: false\n---\n'
}

/** Corps d'une règle Claude traduit dans les conventions de lien de Cursor. */
const toCursorBody = (claudeBody: string) =>
  claudeBody
    .replace(
      /\]\(<((?:src|docs|scripts|e2e)\/[^>]+)>\)/g,
      ']($<mdc>)'.replace('$<mdc>', '<mdc:$1>')
    )
    .replace(/\]\(((?:src|docs|scripts|e2e)\/[^)\s]+)\)/g, '](mdc:$1)')
    .replace(/\]\((\d\d-[^)\s]+)\.md\)/g, '](mdc:$1.mdc)')
    .replace(/\.claude\/rules\/([^\s`)]+)\.md/g, '.cursor/rules/$1.mdc')

// 1. Les chemins de fichiers cités existent-ils ?
const checkCitedPaths = () => {
  const link = /\]\(<?(?:mdc:)?((?:src|docs|scripts|e2e)\/[^)>\s]+?)>?\)/g
  for (const [dir, ext] of [
    [CLAUDE_RULES, '.md'],
    [CURSOR_RULES, '.mdc'],
  ] as const) {
    for (const file of walk(dir, ext)) {
      const text = fs.readFileSync(file, 'utf8')
      for (const match of text.matchAll(link)) {
        const cited = match[1]
        // un chemin coupé sur une parenthèse ouvrante n'est pas un vrai chemin
        if (cited.includes('(') && !cited.includes(')')) continue
        if (!fs.existsSync(cited))
          fail(file, `chemin cité inexistant : ${cited}`)
      }
    }
  }
}

// 2. L'index liste-t-il toutes les règles, sans lien mort ?
const checkIndex = () => {
  for (const [dir, ext] of [
    [CLAUDE_RULES, '.md'],
    [CURSOR_RULES, '.mdc'],
  ] as const) {
    const indexPath = path.join(
      dir,
      `RULES-INDEX${ext === '.md' ? '.md' : '.md'}`
    )
    if (!fs.existsSync(indexPath)) {
      fail(indexPath, 'index absent')
      continue
    }
    const index = fs.readFileSync(indexPath, 'utf8')

    for (const rule of walk(dir, ext)) {
      const name = path.basename(rule, ext)
      if (name === 'RULES-INDEX') continue
      if (!index.includes(name))
        fail(indexPath, `règle absente de l'index : ${name}`)
    }

    for (const match of index.matchAll(/\]\((\d\d-[^)\s]+\.mdc?)\)/g)) {
      const target = path.join(dir, match[1])
      const twin = target.replace(/\.mdc?$/, ext)
      if (!fs.existsSync(target) && !fs.existsSync(twin)) {
        fail(indexPath, `lien mort dans l'index : ${match[1]}`)
      }
    }
  }
}

// 3. Les deux jeux de règles disent-ils la même chose ?
const checkTwins = (shouldFix: boolean) => {
  for (const claudeFile of walk(CLAUDE_RULES, '.md')) {
    const relative = path.relative(CLAUDE_RULES, claudeFile)
    const isIndex = path.basename(claudeFile) === 'RULES-INDEX.md'
    const cursorFile = path.join(
      CURSOR_RULES,
      isIndex ? relative : relative.replace(/\.md$/, '.mdc')
    )

    const expected = toCursorBody(
      stripFrontmatter(fs.readFileSync(claudeFile, 'utf8'))
    )

    if (!fs.existsSync(cursorFile)) {
      if (shouldFix) {
        fs.mkdirSync(path.dirname(cursorFile), {recursive: true})
        fs.writeFileSync(cursorFile, frontmatterOf('') + expected)
        console.log(`  créé   ${cursorFile}`)
      } else {
        fail(cursorFile, 'copie Cursor absente')
      }
      continue
    }

    const current = fs.readFileSync(cursorFile, 'utf8')
    if (stripFrontmatter(current) === expected) continue

    if (shouldFix) {
      fs.writeFileSync(cursorFile, frontmatterOf(current) + expected)
      console.log(`  aligné ${cursorFile}`)
    } else {
      fail(
        cursorFile,
        'diverge de la règle Claude (lancer `pnpm check:rules --fix`)'
      )
    }
  }
}

// 4. Reste-t-il des patterns que l'architecture actuelle a rendus faux ?
const checkStalePatterns = () => {
  const files = DESCRIBE_THE_CODE.flatMap((entry) =>
    fs.existsSync(entry) && fs.statSync(entry).isDirectory()
      ? [...walk(entry, '.md'), ...walk(entry, '.mdc'), ...walk(entry, '.mdx')]
      : fs.existsSync(entry)
        ? [entry]
        : []
  )

  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf8').split('\n')
    for (const [index, line] of lines.entries()) {
      for (const {pattern, why, allow} of STALE_PATTERNS) {
        if (!pattern.test(line)) continue
        if (allow?.test(line)) continue
        fail(
          `${file}:${index + 1}`,
          `pattern périmé « ${line.trim().slice(0, 70)} » — ${why}`
        )
      }
    }
  }
}

const shouldFix = process.argv.includes('--fix')

checkTwins(shouldFix)
checkCitedPaths()
checkIndex()
checkStalePatterns()

if (failures.length > 0) {
  console.error(
    `\n❌ ${failures.length} défaut(s) d'alignement entre le code et les règles :\n`
  )
  for (const failure of failures) console.error(`  ${failure}\n`)
  console.error(
    'Ces défauts ne cassent pas le build : ils font suivre à un agent une version périmée.\n'
  )
  process.exit(1)
}

console.log('✅ Règles et documentation alignées sur le code.')
