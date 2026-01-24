import {ArrowRight, Calendar, Clock, FileText} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

import {Badge} from '@/components/ui/badge'
import {UnifiedBlogPost} from '@/services/types/domain/blog-types'

const categoryColors: Record<string, {bg: string; accent: string}> = {
  Technology: {bg: 'bg-blue-50 dark:bg-blue-950/30', accent: 'text-blue-500'},
  Business: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    accent: 'text-emerald-500',
  },
  Design: {bg: 'bg-purple-50 dark:bg-purple-950/30', accent: 'text-purple-500'},
  Marketing: {
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    accent: 'text-orange-500',
  },
  Development: {
    bg: 'bg-indigo-50 dark:bg-indigo-950/30',
    accent: 'text-indigo-500',
  },
  Tutorial: {bg: 'bg-green-50 dark:bg-green-950/30', accent: 'text-green-500'},
  News: {bg: 'bg-rose-50 dark:bg-rose-950/30', accent: 'text-rose-500'},
  default: {bg: 'bg-muted', accent: 'text-muted-foreground'},
}

function ImagePlaceholder({categoryName}: {categoryName?: string}) {
  const colors =
    categoryColors[categoryName || 'default'] || categoryColors.default

  return (
    <div
      className={`${colors.bg} relative flex h-full w-full items-center justify-center overflow-hidden`}
    >
      <div className="absolute -top-4 -right-4 h-20 w-20 rounded-full bg-current opacity-[0.03]" />
      <div className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-current opacity-[0.03]" />
      <div className="relative flex flex-col items-center gap-2">
        <div className={`${colors.accent} opacity-40`}>
          <FileText className="h-10 w-10" strokeWidth={1.5} />
        </div>
        {categoryName && (
          <span className={`${colors.accent} text-xs font-medium opacity-60`}>
            {categoryName}
          </span>
        )}
      </div>
    </div>
  )
}

interface RelatedArticlesProps {
  posts: UnifiedBlogPost[]
  locale: string
  translations: {
    title: string
    readMore: string
  }
}

export function RelatedArticles({
  posts,
  locale,
  translations,
}: RelatedArticlesProps) {
  if (posts.length === 0) {
    return null
  }

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return ''
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(date))
  }

  return (
    <section className="border-border mt-16 border-t pt-12">
      <h2 className="mb-8 text-2xl font-bold">{translations.title}</h2>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/blog/${post.slug}`}
            className="bg-card hover:bg-muted/50 group flex flex-col overflow-hidden rounded-xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
          >
            <div className="relative aspect-video overflow-hidden">
              {post.image ? (
                <Image
                  src={post.image}
                  alt={post.title}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <ImagePlaceholder categoryName={post.category?.name} />
              )}
              {post.category && (
                <Badge className="absolute top-3 left-3 bg-black/60 text-white backdrop-blur-sm">
                  {post.category.name}
                </Badge>
              )}
            </div>

            <div className="flex flex-1 flex-col p-4">
              <h3 className="group-hover:text-primary mb-2 line-clamp-2 font-semibold transition-colors">
                {post.title}
              </h3>

              <p className="text-muted-foreground mb-4 line-clamp-2 flex-1 text-sm">
                {post.description}
              </p>

              <div className="text-muted-foreground flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(post.publishedAt || post.createdAt)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {post.readTime}
                </span>
              </div>

              <div className="text-primary mt-3 flex items-center gap-1 text-sm font-medium">
                {translations.readMore}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
