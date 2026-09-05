import fs from 'fs'
import matter from 'gray-matter'

import {
  type DocItem,
  getDocFilePath,
  getDocsStructure,
} from './docs-file-helper'

export interface SearchResult {
  id: string
  title: string
  content: string
  type: 'page' | 'section'
  url: string
  slug: string
}

interface ContentSection {
  id: string
  title: string
  content: string
  level: number
}

function extractTextContent(mdxContent: string): string {
  // Supprimer les composants MDX et ne garder que le texte
  return (
    mdxContent
      // Supprimer les blocs de code
      .replace(/```[\s\S]*?```/g, '')
      // Supprimer le code inline
      .replace(/`[^`]+`/g, '')
      // Supprimer les composants JSX/MDX
      .replace(/<[^>]*>/g, '')
      // Supprimer les balises de composants fermantes
      .replace(/<\/[^>]*>/g, '')
      // Supprimer les callouts et autres composants
      .replace(/<Callout[\s\S]*?<\/Callout>/g, '')
      .replace(/<Steps[\s\S]*?<\/Steps>/g, '')
      .replace(/<Tabs[\s\S]*?<\/Tabs>/g, '')
      // Nettoyer les espaces multiples
      .replace(/\s+/g, ' ')
      .trim()
  )
}

function extractSections(mdxContent: string): ContentSection[] {
  const sections: ContentSection[] = []
  const lines = mdxContent.split('\n')
  let currentSection: ContentSection | undefined
  let contentBuffer: string[] = []

  for (const line of lines) {
    const trimmedLine = line.trim()

    // Détecter les headings
    const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/)

    if (headingMatch) {
      // Sauvegarder la section précédente
      if (currentSection && contentBuffer.length > 0) {
        currentSection.content = extractTextContent(contentBuffer.join('\n'))
        sections.push(currentSection)
      }

      // Créer une nouvelle section
      const level = headingMatch[1].length
      const title = headingMatch[2]
      const id = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')

      currentSection = {
        id,
        title,
        content: '',
        level,
      }
      contentBuffer = []
    } else {
      // Ajouter le contenu à la section courante
      contentBuffer.push(line)
    }
  }

  // Sauvegarder la dernière section
  if (currentSection && contentBuffer.length > 0) {
    currentSection.content = extractTextContent(contentBuffer.join('\n'))
    sections.push(currentSection)
  }

  return sections
}

function searchInContent(
  query: string,
  content: string,
  title: string
): number {
  const queryLower = query.toLowerCase()
  const titleLower = title.toLowerCase()
  const contentLower = content.toLowerCase()

  let score = 0

  // Score pour match exact dans le titre
  if (titleLower.includes(queryLower)) {
    score += 100
    if (titleLower.startsWith(queryLower)) {
      score += 50
    }
  }

  // Score pour match dans le contenu
  if (contentLower.includes(queryLower)) {
    score += 10
    // Bonus si le terme apparaît plusieurs fois
    const matches = (contentLower.match(new RegExp(queryLower, 'g')) || [])
      .length
    score += matches * 5
  }

  return score
}

function searchInItems(
  items: DocItem[],
  query: string,
  locale: string,
  results: SearchResult[]
): void {
  for (const item of items) {
    if (item.type === 'file') {
      try {
        const filePath = getDocFilePath(item.slug, locale)
        if (!filePath || !fs.existsSync(filePath)) {
          continue
        }

        const fileContent = fs.readFileSync(filePath, 'utf-8')
        const {data, content: mdxContent} = matter(fileContent)

        const pageTitle = data.title || item.title
        const pageContent = extractTextContent(mdxContent)

        // Rechercher dans la page entière
        const pageScore = searchInContent(query, pageContent, pageTitle)
        if (pageScore > 0) {
          results.push({
            id: `page-${item.slug}`,
            title: pageTitle,
            content: data.description || `${pageContent.substring(0, 150)}...`,
            type: 'page',
            url: item.href,
            slug: item.slug,
          })
        }

        // Rechercher dans les sections
        const sections = extractSections(mdxContent)
        for (const section of sections) {
          const sectionScore = searchInContent(
            query,
            section.content,
            section.title
          )
          if (sectionScore > 0) {
            results.push({
              id: `section-${item.slug}-${section.id}`,
              title: section.title,
              content: `${section.content.substring(0, 150)}...`,
              type: 'section',
              url: `${item.href}#${section.id}`,
              slug: item.slug,
            })
          }
        }
      } catch (error) {
        console.warn(`Error searching in file ${item.slug}:`, error)
      }
    }

    // Recherche récursive dans les enfants
    if (item.children) {
      searchInItems(item.children, query, locale, results)
    }
  }
}

export function searchDocs(
  query: string,
  locale: string = 'en'
): SearchResult[] {
  if (!query.trim()) {
    return []
  }

  const structure = getDocsStructure(locale)
  const results: SearchResult[] = []

  searchInItems(structure.items, query.trim(), locale, results)

  // Trier par pertinence (score implicite basé sur l'ordre d'ajout et le type)
  return results
    .sort((a, b) => {
      // Prioriser les pages sur les sections
      if (a.type === 'page' && b.type === 'section') return -1
      if (a.type === 'section' && b.type === 'page') return 1

      // Prioriser les matches dans le titre
      const aInTitle = a.title.toLowerCase().includes(query.toLowerCase())
      const bInTitle = b.title.toLowerCase().includes(query.toLowerCase())
      if (aInTitle && !bInTitle) return -1
      if (!aInTitle && bInTitle) return 1

      return 0
    })
    .slice(0, 20) // Limiter à 20 résultats
}
