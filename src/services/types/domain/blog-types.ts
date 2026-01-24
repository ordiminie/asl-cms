export type UnifiedBlogPost = {
  id: string // DB: post.id | MDX: slug
  slug: string
  title: string
  description: string
  content: string
  source: 'database' | 'mdx'

  // Optional (DB has, MDX via frontmatter)
  author?: {name: string; image?: string; bio?: string}
  category?: {name: string}
  hashtags?: string[]
  image?: string // Featured image URL

  // Dates (MDX: via frontmatter publishedAt/updatedAt)
  publishedAt?: Date // Date de publication (pour scheduling MDX)
  createdAt?: Date // DB: createdAt
  updatedAt?: Date // MDX: frontmatter updatedAt, DB: updatedAt

  nbView: number // MDX: 0
  nbLike: number // MDX: 0
  readTime: string
  language: string
}

export type MdxFrontmatter = {
  id?: string // Unique post identifier (e.g., "001-thumbnails-parfaites")
  lang?: string // Language code (en, fr, es)
  slug?: string // Language-specific slug for URL
  title?: string
  description?: string
  author?: string
  category?: string
  hashtags?: string[]
  publishedAt?: string // ISO date string
  updatedAt?: string // ISO date string
  image?: string
}

export type MdxBlogPost = {
  postId: string // Folder name / post identifier
  slug: string // URL slug (from frontmatter or fallback to postId)
  content: string
  frontmatter: MdxFrontmatter
  extension: string
}
