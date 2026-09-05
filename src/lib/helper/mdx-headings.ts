export interface MdxHeading {
  id: string
  text: string
  level: number
}

const FENCE = /^\s*(```|~~~)/
const ATX_HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/
const INLINE_MARKUP = /`([^`]*)`|\*\*([^*]*)\*\*|\*([^*]*)\*|_([^_]*)_/g
const MARKDOWN_LINK = /\[([^\]]*)\]\([^)]*\)/g

export function slugifyHeading(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
}

function stripMarkdown(text: string): string {
  return text
    .replace(MARKDOWN_LINK, '$1')
    .replace(INLINE_MARKUP, (_match, ...groups) => groups.find(Boolean) ?? '')
    .trim()
}

/**
 * Extrait les titres d'une source MDX pour construire le sommaire côté serveur.
 *
 * Le sommaire ne peut pas être lu dans le DOM : le contenu MDX est streamé, et
 * un effet client s'exécute avant son arrivée. La source, elle, est disponible
 * au rendu.
 *
 * Le niveau 1 est exclu : le titre de la page en est déjà un.
 */
export function extractMdxHeadings(
  source: string,
  {minLevel = 2, maxLevel = 4}: {minLevel?: number; maxLevel?: number} = {}
): MdxHeading[] {
  const headings: MdxHeading[] = []
  let insideFence = false

  for (const line of source.split('\n')) {
    if (FENCE.test(line)) {
      insideFence = !insideFence
      continue
    }
    if (insideFence) continue

    const match = line.match(ATX_HEADING)
    if (!match) continue

    const level = match[1].length
    if (level < minLevel || level > maxLevel) continue

    const text = stripMarkdown(match[2])
    if (!text) continue

    // Le même slug que le mapping des titres, sans déduplication : les ancres
    // doivent correspondre exactement aux id posés dans le HTML.
    const id = slugifyHeading(text)
    if (!id) continue

    headings.push({id, text, level})
  }

  return headings
}
