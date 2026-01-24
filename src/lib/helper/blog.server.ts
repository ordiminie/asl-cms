import 'server-only'

import fs from 'fs'
import matter from 'gray-matter'
import path from 'path'

import {MdxBlogPost, MdxFrontmatter} from '@/services/types/domain/blog-types'

const SUPPORTED_EXTENSIONS = ['.mdx', '.mdc']

function getContentDir(locale?: string): string {
  const baseDir = path.join(
    process.cwd(),
    'src/app/[locale]/(public)/blog/mdx/_files'
  )
  if (locale) {
    const localeDir = path.join(baseDir, locale)
    if (fs.existsSync(localeDir)) {
      return localeDir
    }
  }
  return baseDir
}

export function getContentSlugs(locale?: string): string[] {
  const contentDir = getContentDir(locale)
  if (!fs.existsSync(contentDir)) {
    return []
  }

  const files = fs.readdirSync(contentDir)
  return files
    .filter((file) => SUPPORTED_EXTENSIONS.some((ext) => file.endsWith(ext)))
    .map((file) => file.replace(/\.(mdx|mdc)$/, ''))
}

export const getMDXSlugs = getContentSlugs

export function getContentBySlug(
  slug: string,
  locale?: string
): {content: string; extension: string} | null {
  const contentDir = getContentDir(locale)

  for (const ext of SUPPORTED_EXTENSIONS) {
    const filePath = path.join(contentDir, `${slug}${ext}`)
    if (fs.existsSync(filePath)) {
      return {
        content: fs.readFileSync(filePath, 'utf8'),
        extension: ext,
      }
    }
  }

  if (locale) {
    const fallbackDir = getContentDir()
    for (const ext of SUPPORTED_EXTENSIONS) {
      const filePath = path.join(fallbackDir, `${slug}${ext}`)
      if (fs.existsSync(filePath)) {
        return {
          content: fs.readFileSync(filePath, 'utf8'),
          extension: ext,
        }
      }
    }
  }

  return null
}

export function getMDXContent(slug: string, locale?: string): string | null {
  const result = getContentBySlug(slug, locale)
  return result?.content ?? null
}

export function parseFrontmatter(content: string): {
  frontmatter: MdxFrontmatter
  body: string
} {
  const {data, content: body} = matter(content)
  return {
    frontmatter: data as MdxFrontmatter,
    body,
  }
}

function extractTitleFromContent(content: string, slug: string): string {
  const titleMatch = content.match(/^#\s+(.+)/m)
  return titleMatch ? titleMatch[1] : slug
}

function extractDescriptionFromContent(content: string): string {
  const paragraphMatch = content.match(/^(?!#|---)(.+)/m)
  return paragraphMatch
    ? `${paragraphMatch[1].slice(0, 150)}...`
    : 'Aucune description disponible.'
}

function calculateReadTime(content: string): string {
  const wordsPerMinute = 200
  const wordCount = content.split(/\s+/).length
  const readTime = Math.ceil(wordCount / wordsPerMinute)
  return `${readTime} min`
}

export function getMdxBlogPost(
  slug: string,
  locale?: string
): MdxBlogPost | null {
  const result = getContentBySlug(slug, locale)
  if (!result) return null

  const {frontmatter, body} = parseFrontmatter(result.content)

  return {
    slug,
    content: body,
    frontmatter,
    extension: result.extension,
  }
}

export function getAllMdxBlogPosts(locale?: string): MdxBlogPost[] {
  const slugs = getContentSlugs(locale)
  const posts: MdxBlogPost[] = []

  for (const slug of slugs) {
    const post = getMdxBlogPost(slug, locale)
    if (post) {
      posts.push(post)
    }
  }

  return posts
}

export function extractPostMetadata(
  content: string,
  slug: string
): {
  slug: string
  title: string
  description: string
  readTime: string
} {
  const {frontmatter, body} = parseFrontmatter(content)

  const title = frontmatter.title || extractTitleFromContent(body, slug)
  const description =
    frontmatter.description || extractDescriptionFromContent(body)
  const readTime = calculateReadTime(body)

  return {
    slug,
    title,
    description,
    readTime,
  }
}

export function getAllBlogPosts(locale?: string): Array<{
  slug: string
  title: string
  description: string
  readTime: string
  content: string
}> {
  const slugs = getContentSlugs(locale)

  return slugs
    .map((slug) => {
      const result = getContentBySlug(slug, locale)
      if (!result) return null

      const metadata = extractPostMetadata(result.content, slug)
      const {body} = parseFrontmatter(result.content)

      return {
        ...metadata,
        content: body,
      }
    })
    .filter(Boolean) as Array<{
    slug: string
    title: string
    description: string
    readTime: string
    content: string
  }>
}

export function getBlogPost(
  slug: string,
  locale?: string
): {
  slug: string
  title: string
  description: string
  readTime: string
  content: string
} | null {
  const result = getContentBySlug(slug, locale)
  if (!result) return null

  const metadata = extractPostMetadata(result.content, slug)
  const {body} = parseFrontmatter(result.content)

  return {
    ...metadata,
    content: body,
  }
}

export function blogPostExists(slug: string, locale?: string): boolean {
  return getContentSlugs(locale).includes(slug)
}

export function getAllMdxSlugsWithLocales(): {slug: string; locale: string}[] {
  const baseDir = path.join(
    process.cwd(),
    'src/app/[locale]/(public)/blog/mdx/_files'
  )

  const results: {slug: string; locale: string}[] = []

  if (!fs.existsSync(baseDir)) {
    return results
  }

  const defaultSlugs = getContentSlugs()
  for (const slug of defaultSlugs) {
    results.push({slug, locale: 'en'})
  }

  const entries = fs.readdirSync(baseDir, {withFileTypes: true})
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const locale = entry.name
      const localeSlugs = getContentSlugs(locale)
      for (const slug of localeSlugs) {
        if (!results.some((r) => r.slug === slug && r.locale === locale)) {
          results.push({slug, locale})
        }
      }
    }
  }

  return results
}
