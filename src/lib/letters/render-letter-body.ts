import {remark} from 'remark'

import {RESTRICTED_SANITIZE_SCHEMA} from '@/lib/cms/render-page-block'
import {substituteVariables} from '@/services/rules/campaign-rules'
import type {CampaignVariableValues} from '@/services/types/domain/campaign-types'

/**
 * Le corps d'une campagne en blocs imprimables (s28, ADR 066 §2). L'arbre
 * `mdast` de remark est lu avec le **schema restreint du CMS** : une balise
 * hors de la liste est deballee (son texte reste), le HTML brut et les images
 * ne s'impriment pas. Les variables sont remplacees **dans les noeuds texte**,
 * apres l'analyse : une valeur n'est jamais lue comme du Markdown. Un lien
 * s'imprime en clair, « texte (adresse) ».
 */

export type LetterRun = {text: string; bold: boolean; italic: boolean}

export type LetterBlock =
  | {kind: 'paragraph'; runs: LetterRun[]}
  | {kind: 'heading'; level: 2 | 3; runs: LetterRun[]}
  | {kind: 'list'; ordered: boolean; items: LetterRun[][]}
  | {kind: 'quote'; paragraphs: LetterRun[][]}

/** Ce que le rendu lit d'un noeud `mdast`, sans dependre de ses types. */
type MarkdownNode = {
  type: string
  value?: string
  depth?: number
  ordered?: boolean | null
  url?: string
  children?: MarkdownNode[]
}

type RunStyle = {bold: boolean; italic: boolean}

/** Remplace les variables d'un noeud texte, valeurs brutes. */
type Substitute = (text: string) => string

const PLAIN: RunStyle = {bold: false, italic: false}

const ALLOWED_TAGS = new Set<string>(RESTRICTED_SANITIZE_SCHEMA.tagNames)
const ALLOWED_PROTOCOLS = new Set<string>(
  RESTRICTED_SANITIZE_SCHEMA.protocols.href
)

const SCHEME_PATTERN = /^([a-z][a-z0-9+.-]*):/i

/** L'adresse d'un lien, si son protocole est permis par le schema. */
const printableUrlOf = (url: string | undefined): string | null => {
  const trimmed = url?.trim()
  if (!trimmed) return null
  const scheme = SCHEME_PATTERN.exec(trimmed)?.[1].toLowerCase()
  return scheme && !ALLOWED_PROTOCOLS.has(scheme) ? null : trimmed
}

const mergeRuns = (runs: readonly LetterRun[]): LetterRun[] =>
  runs.reduce<LetterRun[]>((merged, run) => {
    if (run.text === '') return merged
    const last = merged.at(-1)
    if (last && last.bold === run.bold && last.italic === run.italic) {
      return [...merged.slice(0, -1), {...last, text: last.text + run.text}]
    }
    return [...merged, run]
  }, [])

const textOfRuns = (runs: readonly LetterRun[]): string =>
  runs.map((run) => run.text).join('')

const runsOf = (
  nodes: readonly MarkdownNode[],
  style: RunStyle,
  substitute: Substitute
): LetterRun[] =>
  nodes.flatMap((node): LetterRun[] => {
    switch (node.type) {
      case 'text':
      case 'inlineCode':
        return [
          {
            text: substitute(node.value ?? ''),
            ...style,
          },
        ]
      case 'break':
        return [{text: '\n', ...style}]
      case 'strong':
        return runsOf(node.children ?? [], {...style, bold: true}, substitute)
      case 'emphasis':
        return runsOf(node.children ?? [], {...style, italic: true}, substitute)
      case 'link':
        return linkRunsOf(node, style, substitute)
      case 'html':
      case 'image':
      case 'imageReference':
        return []
      default:
        return runsOf(node.children ?? [], style, substitute)
    }
  })

const linkRunsOf = (
  node: MarkdownNode,
  style: RunStyle,
  substitute: Substitute
): LetterRun[] => {
  const runs = runsOf(node.children ?? [], style, substitute)
  const url = ALLOWED_TAGS.has('a') ? printableUrlOf(node.url) : null
  if (!url || textOfRuns(runs) === url) return runs
  return [...runs, {text: ` (${url})`, ...style}]
}

const paragraphOf = (node: MarkdownNode, substitute: Substitute): LetterRun[] =>
  mergeRuns(runsOf(node.children ?? [], PLAIN, substitute))

const headingLevelOf = (depth: number | undefined): 2 | 3 | null =>
  (depth === 2 || depth === 3) && ALLOWED_TAGS.has(`h${depth}`) ? depth : null

/** Les lignes d'un element de liste ; une liste imbriquee suit a plat. */
const listItemsOf = (
  item: MarkdownNode,
  substitute: Substitute
): LetterRun[][] => {
  const own: LetterRun[] = []
  const nested: LetterRun[][] = []
  for (const child of item.children ?? []) {
    if (child.type === 'list') {
      for (const sub of child.children ?? []) {
        nested.push(...listItemsOf(sub, substitute))
      }
    } else {
      const runs = paragraphOf(child, substitute)
      if (own.length > 0 && runs.length > 0) own.push({text: ' ', ...PLAIN})
      own.push(...runs)
    }
  }
  const merged = mergeRuns(own)
  return [...(merged.length > 0 ? [merged] : []), ...nested]
}

const blockOf = (node: MarkdownNode, substitute: Substitute): LetterBlock[] => {
  switch (node.type) {
    case 'heading': {
      const runs = paragraphOf(node, substitute)
      const level = headingLevelOf(node.depth)
      if (runs.length === 0) return []
      return level
        ? [{kind: 'heading', level, runs}]
        : [{kind: 'paragraph', runs}]
    }
    case 'list': {
      const items = (node.children ?? []).flatMap((item) =>
        listItemsOf(item, substitute)
      )
      return items.length > 0
        ? [{kind: 'list', ordered: node.ordered === true, items}]
        : []
    }
    case 'blockquote': {
      const paragraphs = (node.children ?? [])
        .flatMap((child) => blockOf(child, substitute))
        .map((block) => runsOfBlock(block))
        .filter((runs) => runs.length > 0)
      return paragraphs.length > 0 ? [{kind: 'quote', paragraphs}] : []
    }
    case 'code': {
      const runs = mergeRuns([
        {
          text: substitute(node.value ?? ''),
          ...PLAIN,
        },
      ])
      return runs.length > 0 ? [{kind: 'paragraph', runs}] : []
    }
    case 'html':
    case 'thematicBreak':
    case 'definition':
      return []
    default: {
      const runs = paragraphOf(node, substitute)
      return runs.length > 0 && textOfRuns(runs).trim() !== ''
        ? [{kind: 'paragraph', runs}]
        : []
    }
  }
}

const runsOfBlock = (block: LetterBlock): LetterRun[] => {
  switch (block.kind) {
    case 'paragraph':
    case 'heading':
      return block.runs
    case 'list':
      return block.items.flatMap((item, index) =>
        index === 0 ? item : [{text: '\n', ...PLAIN}, ...item]
      )
    case 'quote':
      return block.paragraphs.flatMap((runs, index) =>
        index === 0 ? runs : [{text: '\n', ...PLAIN}, ...runs]
      )
  }
}

/**
 * Le corps d'une lettre, en blocs, variables du destinataire remplacees ;
 * `extra` en remplace d'autres (s36, ADR 074 §2), vide par defaut.
 */
export const letterBodyBlocksOf = (
  markdown: string,
  values: CampaignVariableValues,
  extra: Readonly<Record<string, string>> = {}
): LetterBlock[] => {
  const substitute: Substitute = (text) =>
    substituteVariables(text, values, (v) => v, extra)
  const root = remark().parse(markdown) as unknown as MarkdownNode
  return (root.children ?? []).flatMap((node) => blockOf(node, substitute))
}

/** Le texte d'un bloc, lignes separees par un retour : pour mesurer et tester. */
export const plainTextOfBlock = (block: LetterBlock): string =>
  textOfRuns(runsOfBlock(block))

const plainRun = (text: string): LetterRun => ({text, ...PLAIN})

/**
 * Le courrier du lancement des invitations (s42b, ADR 072 §6) : un texte du
 * bureau en paragraphes **texte**, sans analyse Markdown ni variable, puis
 * l'encart de l'adresse du site (cadre 1 pt, §6.1). Sans adresse, aucun
 * encart.
 */
export const letterTextBlocksOf = (
  text: string,
  siteLine: string | null
): LetterBlock[] => [
  ...text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '')
    .map((paragraph): LetterBlock => ({
      kind: 'paragraph',
      runs: [plainRun(paragraph)],
    })),
  ...(siteLine
    ? [{kind: 'quote' as const, paragraphs: [[plainRun(siteLine)]]}]
    : []),
]
