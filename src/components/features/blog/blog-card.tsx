import {
  ArrowRight,
  Calendar,
  Clock,
  Eye,
  FileText,
  Heart,
  User,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar'
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

interface BlogCardProps {
  post: UnifiedBlogPost
  locale: string
  featured?: boolean
  translations: {
    noCategory: string
    views: string
    likes: string
    readMore: string
  }
}

function ImagePlaceholder({
  title,
  categoryName,
  size = 'normal',
}: {
  title: string
  categoryName?: string
  size?: 'normal' | 'large'
}) {
  const colors =
    categoryColors[categoryName || 'default'] || categoryColors.default
  const iconSize = size === 'large' ? 'h-16 w-16' : 'h-12 w-12'

  return (
    <div
      className={`${colors.bg} relative flex h-full w-full items-center justify-center overflow-hidden`}
    >
      <div className="absolute inset-0 opacity-[0.03]">
        <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="grid"
              width="32"
              height="32"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 32 0 L 0 0 0 32"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>
      <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-current opacity-[0.03]" />
      <div className="absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-current opacity-[0.03]" />
      <div className="relative flex flex-col items-center gap-3">
        <div className={`${colors.accent} opacity-40`}>
          <FileText className={iconSize} strokeWidth={1.5} />
        </div>
        <span className={`${colors.accent} text-sm font-medium opacity-60`}>
          {categoryName || title.charAt(0).toUpperCase() + title.slice(1, 12)}
        </span>
      </div>
    </div>
  )
}

export function BlogCard({
  post,
  locale,
  featured = false,
  translations,
}: BlogCardProps) {
  const formatDate = (date: Date | null | undefined) => {
    if (!date) return ''
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(date))
  }

  if (featured) {
    return (
      <Link href={`/blog/${post.slug}`} className="block">
        <article className="bg-card group overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <div className="grid gap-0 lg:grid-cols-2">
            <div className="relative aspect-video overflow-hidden lg:aspect-auto lg:min-h-[360px]">
              {post.image ? (
                <Image
                  src={post.image}
                  alt={post.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  priority
                />
              ) : (
                <ImagePlaceholder
                  title={post.title}
                  categoryName={post.category?.name}
                  size="large"
                />
              )}
              {post.category && (
                <Badge className="absolute top-4 left-4 bg-black/60 text-white backdrop-blur-sm">
                  {post.category.name}
                </Badge>
              )}
            </div>

            <div className="flex flex-col justify-center p-8">
              {post.hashtags && post.hashtags.length > 0 && (
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  {post.hashtags.slice(0, 3).map((hashtag) => (
                    <Badge
                      key={hashtag}
                      variant="secondary"
                      className="text-xs"
                    >
                      #{hashtag}
                    </Badge>
                  ))}
                </div>
              )}

              <h2 className="group-hover:text-primary mb-4 text-2xl font-bold transition-colors lg:text-3xl">
                {post.title}
              </h2>

              <p className="text-muted-foreground mb-6 line-clamp-3 text-base leading-relaxed">
                {post.description}
              </p>

              <div className="text-muted-foreground mb-6 flex flex-wrap items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {formatDate(post.publishedAt || post.createdAt)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {post.readTime}
                </span>
                {post.source === 'database' && (
                  <>
                    <span className="flex items-center gap-1.5">
                      <Eye className="h-4 w-4" />
                      {post.nbView} {translations.views}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Heart className="h-4 w-4" />
                      {post.nbLike} {translations.likes}
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center justify-between">
                {post.author && (
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={post.author.image || ''}
                        alt={post.author.name || ''}
                      />
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">
                      {post.author.name}
                    </span>
                  </div>
                )}
                <span className="text-primary group/link flex items-center gap-2 font-semibold">
                  {translations.readMore}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </div>
          </div>
        </article>
      </Link>
    )
  }

  return (
    <Link href={`/blog/${post.slug}`} className="block">
      <article className="bg-card group flex h-full flex-col overflow-hidden rounded-xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
        <div className="relative aspect-video overflow-hidden">
          {post.image ? (
            <Image
              src={post.image}
              alt={post.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <ImagePlaceholder
              title={post.title}
              categoryName={post.category?.name}
            />
          )}
          {post.category && (
            <Badge className="absolute top-3 left-3 bg-black/60 text-white backdrop-blur-sm">
              {post.category.name}
            </Badge>
          )}
        </div>

        <div className="flex flex-1 flex-col p-5">
          {post.hashtags && post.hashtags.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
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

          <h2 className="group-hover:text-primary mb-3 line-clamp-2 text-xl font-semibold transition-colors">
            {post.title}
          </h2>

          <p className="text-muted-foreground mb-4 line-clamp-2 flex-1 text-sm leading-relaxed">
            {post.description}
          </p>

          <div className="text-muted-foreground mb-4 flex flex-wrap items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(post.publishedAt || post.createdAt)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {post.readTime}
            </span>
            {post.source === 'database' && (
              <>
                <span className="flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  {post.nbView}
                </span>
                <span className="flex items-center gap-1">
                  <Heart className="h-3.5 w-3.5" />
                  {post.nbLike}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            {post.author && (
              <div className="flex items-center gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarImage
                    src={post.author.image || ''}
                    alt={post.author.name || ''}
                  />
                  <AvatarFallback className="text-xs">
                    <User className="h-3 w-3" />
                  </AvatarFallback>
                </Avatar>
                <span className="text-muted-foreground text-xs">
                  {post.author.name}
                </span>
              </div>
            )}
            <span className="text-primary group/link flex items-center gap-1 text-sm font-medium">
              {translations.readMore}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </div>
        </div>
      </article>
    </Link>
  )
}
