import Link from 'next/link'

import {Badge} from '@/components/ui/badge'
import {UnifiedBlogPost} from '@/services/types/domain/blog-types'

interface BlogCardProps {
  post: UnifiedBlogPost
  locale: string
  translations: {
    noCategory: string
    views: string
    likes: string
    readMore: string
  }
}

export function BlogCard({post, locale, translations}: BlogCardProps) {
  const formatDate = (date: Date | null | undefined) => {
    if (!date) return ''
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(date))
  }

  return (
    <article className="border-border bg-card hover:bg-muted/50 rounded-lg border p-6 transition-colors">
      <div className="mb-3 flex items-center gap-3">
        <Badge variant="outline">
          {post.category?.name || translations.noCategory}
        </Badge>
        {post.hashtags && post.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {post.hashtags.slice(0, 2).map((hashtag) => (
              <Badge key={hashtag} variant="secondary" className="text-xs">
                #{hashtag}
              </Badge>
            ))}
            {post.hashtags.length > 2 && (
              <Badge variant="secondary" className="text-xs">
                +{post.hashtags.length - 2}
              </Badge>
            )}
          </div>
        )}
      </div>

      <h2 className="mb-3 text-2xl font-semibold">
        <Link
          href={`/blog/${post.slug}`}
          className="text-foreground hover:text-primary transition-colors"
        >
          {post.title}
        </Link>
      </h2>

      <p className="text-muted-foreground mb-4 text-base leading-relaxed">
        {post.description}
      </p>

      <div className="text-muted-foreground flex items-center gap-4 text-sm">
        <time>{formatDate(post.publishedAt || post.createdAt)}</time>
        <span>•</span>
        <span>{post.readTime}</span>
        {post.source === 'database' && (
          <>
            <span>•</span>
            <span>
              {post.nbView} {translations.views}
            </span>
            <span>•</span>
            <span>
              {post.nbLike} {translations.likes}
            </span>
          </>
        )}
        <span>•</span>
        <Link
          href={`/blog/${post.slug}`}
          className="hover:text-foreground font-medium transition-colors"
        >
          {translations.readMore} →
        </Link>
      </div>
    </article>
  )
}
