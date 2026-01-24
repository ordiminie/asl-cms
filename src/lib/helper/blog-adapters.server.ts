import 'server-only'

import {MdxBlogPost, UnifiedBlogPost} from '@/services/types/domain/blog-types'
import {PostData} from '@/services/types/domain/post-types'

function calculateReadTime(content: string): string {
  const wordsPerMinute = 200
  const wordCount = content.split(/\s+/).length
  const readTime = Math.ceil(wordCount / wordsPerMinute)
  return `${readTime} min`
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

export function dbPostToUnified(
  post: PostData,
  locale: string
): UnifiedBlogPost | null {
  const translation = post.postTranslations?.find((t) => t.language === locale)
  if (!translation) return null

  return {
    id: post.id,
    slug: translation.slug,
    title: translation.title,
    description: translation.description || '',
    content: translation.content || '',
    source: 'database',

    author: post.author
      ? {
          name: post.author.name || 'Anonymous',
          image: post.author.image || undefined,
        }
      : undefined,
    category: post.category ? {name: post.category.name} : undefined,
    hashtags: post.postHashtags
      ?.map((ph) => ph.hashtag?.name)
      .filter((name): name is string => Boolean(name)),

    createdAt: post.createdAt || undefined,
    updatedAt: post.updatedAt || undefined,
    publishedAt: post.createdAt || undefined,

    nbView: post.nbView || 0,
    nbLike: post.nbLike || 0,
    readTime: calculateReadTime(translation.content || ''),
    language: locale,
  }
}

export function mdxPostToUnified(
  post: MdxBlogPost,
  locale: string
): UnifiedBlogPost {
  const {frontmatter, content, slug, postId} = post

  const title = frontmatter.title || extractTitleFromContent(content, slug)
  const description =
    frontmatter.description || extractDescriptionFromContent(content)

  const publishedAt = frontmatter.publishedAt
    ? new Date(frontmatter.publishedAt)
    : undefined
  const updatedAt = frontmatter.updatedAt
    ? new Date(frontmatter.updatedAt)
    : undefined

  return {
    id: frontmatter.id || postId,
    slug: frontmatter.slug || slug,
    title,
    description,
    content,
    source: 'mdx',

    author: frontmatter.author ? {name: frontmatter.author} : undefined,
    category: frontmatter.category ? {name: frontmatter.category} : undefined,
    hashtags: frontmatter.hashtags,
    image: frontmatter.image,

    publishedAt,
    createdAt: publishedAt,
    updatedAt,

    nbView: 0,
    nbLike: 0,
    readTime: calculateReadTime(content),
    language: frontmatter.lang || locale,
  }
}

export function isMdxPublished(post: MdxBlogPost): boolean {
  const {publishedAt} = post.frontmatter
  if (!publishedAt) return true
  const publishDate = new Date(publishedAt)
  return publishDate <= new Date()
}
