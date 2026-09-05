import 'server-only'

import fs from 'fs'
import path from 'path'

// Interface pour un document de règle
export interface DocRule {
  slug: string
  title: string
  description: string
  category: string
  readTime: string
  globs?: string
  alwaysApply?: boolean
  content?: string
}

// Chemin vers le dossier des règles
const RULES_DIR = path.join(process.cwd(), '.cursor/rules')
// Chemin vers le dossier de documentation
const DOCS_DIR = path.join(process.cwd(), 'docs')

// Catégories et leurs mappings
const CATEGORY_MAPPING: Record<string, string> = {
  '00-generals': 'Général',
  '01-presentation': 'Présentation',
  '02-services': 'Services',
  '03-persistance': 'Persistance',
  documentation: 'Documentation',
}

// Obtenir toutes les catégories de règles
export function getRuleCategories(): string[] {
  if (!fs.existsSync(RULES_DIR)) {
    return []
  }

  const directories = fs.readdirSync(RULES_DIR, {withFileTypes: true})
  return directories
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .sort()
}

// Obtenir tous les slugs des fichiers MDC et MD
export function getRuleSlugs(): string[] {
  const categories = getRuleCategories()
  const slugs: string[] = []

  for (const category of categories) {
    const categoryPath = path.join(RULES_DIR, category)
    if (fs.existsSync(categoryPath)) {
      const files = fs.readdirSync(categoryPath)
      const categoryRules = files
        .filter((file) => file.endsWith('.mdc'))
        .map((file) => `${category}--${file.replace('.mdc', '')}`) // Utiliser -- au lieu de /

      slugs.push(...categoryRules)
    }
  }

  // Ajouter les fichiers de documentation
  if (fs.existsSync(DOCS_DIR)) {
    const docFiles = fs.readdirSync(DOCS_DIR)
    const docSlugs = docFiles
      .filter((file) => file.endsWith('.md'))
      .map((file) => `documentation--${file.replace('.md', '')}`)

    slugs.push(...docSlugs)
  }

  return slugs
}

// Convertir un slug avec -- vers le chemin de fichier réel
function slugToFilePath(slug: string): string {
  return slug.replace('--', '/')
}

// Obtenir le contenu d'un fichier de règle par slug
export function getRuleContent(slug: string): {
  content: string
  category: string
} {
  const realPath = slugToFilePath(slug)

  // Vérifier si c'est un fichier de documentation
  if (slug.startsWith('documentation--')) {
    const fileName = slug.replace('documentation--', '')
    const filePath = path.join(DOCS_DIR, `${fileName}.md`)

    if (!fs.existsSync(filePath)) {
      throw new Error(`Documentation non trouvée: ${slug}`)
    }

    const rawContent = fs.readFileSync(filePath, 'utf8')
    // Les fichiers MD n'ont pas forcément de frontmatter YAML
    const content = rawContent.replace(/^---[\s\S]*?---\n?/, '')

    return {content, category: 'documentation'}
  }

  // Fichiers de règles normaux
  const filePath = path.join(RULES_DIR, `${realPath}.mdc`)

  if (!fs.existsSync(filePath)) {
    throw new Error(`Règle non trouvée: ${slug}`)
  }

  const rawContent = fs.readFileSync(filePath, 'utf8')
  // Retirer le frontmatter YAML du contenu pour l'affichage
  const content = rawContent.replace(/^---[\s\S]*?---\n?/, '')
  const category = realPath.split('/')[0]

  return {content, category}
}

// Extraire les métadonnées d'une règle à partir de son contenu
export function extractRuleMetadata(
  content: string,
  slug: string,
  category: string
): Omit<DocRule, 'content'> {
  // Traitement spécial pour la documentation
  if (slug.startsWith('documentation--')) {
    const fileName = slug.replace('documentation--', '')
    let title = fileName.replace(/-/g, ' ')
    let description = 'Aucune description disponible.'

    // Extraire le titre depuis le H1
    const contentWithoutFrontmatter = content.replace(/^---[\s\S]*?---\n?/, '')
    const titleMatch = contentWithoutFrontmatter.match(/^#\s+(.+)/m)
    if (titleMatch) {
      title = titleMatch[1].trim()
    }

    // Extraire description depuis le premier paragraphe
    const paragraphMatch = contentWithoutFrontmatter.match(
      /^#[^\n]*\n\n([^\n#]+)/m
    )
    if (paragraphMatch) {
      description = `${paragraphMatch[1].trim().slice(0, 150)}...`
    }

    const readTime = `${Math.ceil(content.length / 1000)} min`

    return {
      slug,
      title,
      description,
      category: 'Documentation',
      readTime,
    }
  }

  const realPath = slugToFilePath(slug)
  let title = realPath.split('/')[1] || slug
  let description = 'Aucune description disponible.'
  let globs: string | undefined
  let alwaysApply: boolean | undefined

  // Extraire le frontmatter YAML
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/)
  if (frontmatterMatch) {
    const yamlContent = frontmatterMatch[1]

    // Extraire les champs du frontmatter
    const titleMatch = yamlContent.match(/title:\s*(.+)/m)
    if (titleMatch && titleMatch[1].trim()) {
      title = titleMatch[1].trim().replace(/['"]/g, '')
    }

    const descriptionMatch = yamlContent.match(/description:\s*(.+)/m)
    if (
      descriptionMatch &&
      descriptionMatch[1].trim() &&
      descriptionMatch[1].trim() !== ''
    ) {
      description = descriptionMatch[1].trim().replace(/['"]/g, '')
    }

    const globsMatch = yamlContent.match(/globs:\s*(.+)/m)
    if (globsMatch && globsMatch[1].trim()) {
      globs = globsMatch[1].trim()
    }

    const alwaysApplyMatch = yamlContent.match(/alwaysApply:\s*(.+)/m)
    if (alwaysApplyMatch) {
      alwaysApply = alwaysApplyMatch[1].trim() === 'true'
    }
  }

  // Fallback sur H1 si pas de titre dans le frontmatter ou titre vide
  if (title === realPath.split('/')[1] || !title.trim()) {
    const contentWithoutFrontmatter = content.replace(/^---[\s\S]*?---\n?/, '')
    const titleMatch = contentWithoutFrontmatter.match(/^#\s+(.+)/m)
    if (titleMatch) {
      title = titleMatch[1].trim()
    }
  }

  // Extraire description depuis le premier paragraphe si vide
  if (description === 'Aucune description disponible.' || !description.trim()) {
    const contentWithoutFrontmatter = content.replace(/^---[\s\S]*?---\n?/, '')
    // Chercher le premier paragraphe après le titre
    const paragraphMatch = contentWithoutFrontmatter.match(
      /^#[^\n]*\n\n([^\n#]+)/m
    )
    if (paragraphMatch) {
      description = `${paragraphMatch[1].trim().slice(0, 150)}...`
    } else {
      // Chercher dans la section "Vue d'ensemble" ou similaire
      const overviewMatch = contentWithoutFrontmatter.match(
        /## Vue d'ensemble[\s\S]*?\n\n([^\n#]+)/
      )
      if (overviewMatch) {
        description = `${overviewMatch[1].trim().slice(0, 150)}...`
      } else {
        // Sinon, chercher n'importe quel texte non-heading après un saut de ligne
        const textMatch = contentWithoutFrontmatter.match(/\n\n([^\n#][^\n]+)/)
        if (textMatch) {
          description = `${textMatch[1].trim().slice(0, 150)}...`
        }
      }
    }
  }

  // Calculer le temps de lecture
  const readTime = `${Math.ceil(content.length / 1000)} min`

  return {
    slug,
    title,
    description,
    category: CATEGORY_MAPPING[category] || category,
    readTime,
    globs,
    alwaysApply,
  }
}

// Obtenir toutes les règles avec leurs métadonnées
export function getAllRules(): DocRule[] {
  const slugs = getRuleSlugs()

  return slugs
    .map((slug) => {
      return getRule(slug)
    })
    .sort((a, b) => {
      // Trier par catégorie puis par titre
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category)
      }
      return a.title.localeCompare(b.title)
    })
}

// Obtenir les règles par catégorie
export function getRulesByCategory(): Record<string, DocRule[]> {
  const allRules = getAllRules()
  const rulesByCategory: Record<string, DocRule[]> = {}

  for (const rule of allRules) {
    if (!rulesByCategory[rule.category]) {
      rulesByCategory[rule.category] = []
    }
    rulesByCategory[rule.category].push(rule)
  }

  return rulesByCategory
}

// Obtenir une règle spécifique par slug
export function getRule(slug: string): DocRule {
  // Traitement spécial pour la documentation
  if (slug.startsWith('documentation--')) {
    const fileName = slug.replace('documentation--', '')
    const filePath = path.join(DOCS_DIR, `${fileName}.md`)

    if (!fs.existsSync(filePath)) {
      throw new Error(`Documentation non trouvée: ${slug}`)
    }

    const rawContent = fs.readFileSync(filePath, 'utf8')
    const cleanContent = rawContent.replace(/^---[\s\S]*?---\n?/, '')

    return {
      ...extractRuleMetadata(rawContent, slug, 'documentation'),
      content: cleanContent,
    }
  }

  // Fichiers de règles normaux
  const realPath = slugToFilePath(slug)
  const filePath = path.join(RULES_DIR, `${realPath}.mdc`)

  if (!fs.existsSync(filePath)) {
    throw new Error(`Règle non trouvée: ${slug}`)
  }

  const rawContent = fs.readFileSync(filePath, 'utf8')
  const category = realPath.split('/')[0]

  // Contenu sans frontmatter pour l'affichage
  const cleanContent = rawContent.replace(/^---[\s\S]*?---\n?/, '')

  return {
    ...extractRuleMetadata(rawContent, slug, category), // Utiliser rawContent pour extraire les métadonnées
    content: cleanContent, // Utiliser cleanContent pour l'affichage
  }
}

// Vérifier si une règle existe
export function ruleExists(slug: string): boolean {
  return getRuleSlugs().includes(slug)
}
