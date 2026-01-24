import 'server-only'

import fs from 'fs'
import matter from 'gray-matter'
import path from 'path'

import {MdxBlogPost, MdxFrontmatter} from '@/services/types/domain/blog-types'

const SUPPORTED_EXTENSIONS = ['.mdx', '.mdc']
const SUPPORTED_LOCALES = ['en', 'fr', 'es']

function getContentDir(): string {
  return path.join(process.cwd(), 'content/blog')
}

export function getPostIds(): string[] {
  const contentDir = getContentDir()
  if (!fs.existsSync(contentDir)) {
    return []
  }

  const entries = fs.readdirSync(contentDir, {withFileTypes: true})
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

function findLocaleFile(
  postId: string,
  locale: string
): {filePath: string; extension: string} | null {
  const contentDir = getContentDir()
  const postDir = path.join(contentDir, postId)

  if (!fs.existsSync(postDir)) {
    return null
  }

  for (const ext of SUPPORTED_EXTENSIONS) {
    const filePath = path.join(postDir, `${locale}${ext}`)
    if (fs.existsSync(filePath)) {
      return {filePath, extension: ext}
    }
  }

  return null
}

export function getContentByPostId(
  postId: string,
  locale: string
): {content: string; extension: string} | null {
  const fileInfo = findLocaleFile(postId, locale)
  if (!fileInfo) {
    return null
  }

  return {
    content: fs.readFileSync(fileInfo.filePath, 'utf8'),
    extension: fileInfo.extension,
  }
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
    : 'No description available.'
}

function calculateReadTime(content: string): string {
  const wordsPerMinute = 200
  const wordCount = content.split(/\s+/).length
  const readTime = Math.ceil(wordCount / wordsPerMinute)
  return `${readTime} min`
}

export function getMdxBlogPost(
  postId: string,
  locale: string
): MdxBlogPost | null {
  const result = getContentByPostId(postId, locale)
  if (!result) return null

  const {frontmatter, body} = parseFrontmatter(result.content)

  const slug = frontmatter.slug || postId

  return {
    postId,
    slug,
    content: body,
    frontmatter,
    extension: result.extension,
  }
}

export function getAllMdxBlogPosts(locale: string): MdxBlogPost[] {
  const postIds = getPostIds()
  const posts: MdxBlogPost[] = []

  for (const postId of postIds) {
    const post = getMdxBlogPost(postId, locale)
    if (post) {
      posts.push(post)
    }
  }

  return posts
}

export function extractPostMetadata(
  content: string,
  slug: string,
  _extension?: string
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

export function getAllBlogPosts(locale: string): Array<{
  slug: string
  title: string
  description: string
  readTime: string
  content: string
}> {
  const postIds = getPostIds()

  return postIds
    .map((postId) => {
      const result = getContentByPostId(postId, locale)
      if (!result) return null

      const {frontmatter, body} = parseFrontmatter(result.content)
      const slug = frontmatter.slug || postId
      const metadata = extractPostMetadata(
        result.content,
        slug,
        result.extension
      )

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
  postId: string,
  locale: string
): {
  slug: string
  title: string
  description: string
  readTime: string
  content: string
} | null {
  const result = getContentByPostId(postId, locale)
  if (!result) return null

  const {frontmatter, body} = parseFrontmatter(result.content)
  const slug = frontmatter.slug || postId
  const metadata = extractPostMetadata(result.content, slug, result.extension)

  return {
    ...metadata,
    content: body,
  }
}

export function blogPostExists(postId: string, locale: string): boolean {
  return getContentByPostId(postId, locale) !== null
}

function isPublishedByDate(publishedAt: string | undefined): boolean {
  if (!publishedAt) return true
  const publishDate = new Date(publishedAt)
  return publishDate <= new Date()
}

export function getAllMdxSlugsWithLocales(): {
  postId: string
  slug: string
  locale: string
}[] {
  const contentDir = getContentDir()
  const results: {postId: string; slug: string; locale: string}[] = []

  if (!fs.existsSync(contentDir)) {
    return results
  }

  const postIds = getPostIds()

  for (const postId of postIds) {
    const postDir = path.join(contentDir, postId)

    for (const locale of SUPPORTED_LOCALES) {
      for (const ext of SUPPORTED_EXTENSIONS) {
        const filePath = path.join(postDir, `${locale}${ext}`)
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8')
          const {frontmatter} = parseFrontmatter(content)

          if (!isPublishedByDate(frontmatter.publishedAt)) {
            break
          }

          const slug = frontmatter.slug || postId
          results.push({postId, slug, locale})
          break
        }
      }
    }
  }

  return results
}

export function getAvailableLocalesForPost(postId: string): string[] {
  const contentDir = getContentDir()
  const postDir = path.join(contentDir, postId)

  if (!fs.existsSync(postDir)) {
    return []
  }

  const locales: string[] = []

  for (const locale of SUPPORTED_LOCALES) {
    for (const ext of SUPPORTED_EXTENSIONS) {
      const filePath = path.join(postDir, `${locale}${ext}`)
      if (fs.existsSync(filePath)) {
        locales.push(locale)
        break
      }
    }
  }

  return locales
}

export function getPostIdBySlug(slug: string, locale: string): string | null {
  const postIds = getPostIds()

  for (const postId of postIds) {
    const post = getMdxBlogPost(postId, locale)
    if (post && post.slug === slug) {
      return postId
    }
  }

  return null
}

export function getPostLanguageVariants(
  postId: string
): {locale: string; slug: string}[] {
  const variants: {locale: string; slug: string}[] = []
  const availableLocales = getAvailableLocalesForPost(postId)

  for (const locale of availableLocales) {
    const post = getMdxBlogPost(postId, locale)
    if (post && isPublishedByDate(post.frontmatter.publishedAt)) {
      variants.push({locale, slug: post.slug})
    }
  }

  return variants
}

export const getContentSlugs = getPostIds
export const getMDXSlugs = getPostIds
export const getMDXContent = (
  postId: string,
  locale: string
): string | null => {
  const result = getContentByPostId(postId, locale)
  return result?.content ?? null
}
export const getContentBySlug = getContentByPostId
