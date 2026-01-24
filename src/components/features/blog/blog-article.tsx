import rehypeShiki from '@shikijs/rehype'
import {ArrowLeft, Calendar, Clock, Eye, FileText, User} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import {MDXRemote} from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'

import {LikeButton} from '@/components/features/blog/like-button'
import {RelatedArticles} from '@/components/features/blog/related-articles'
import {mdxComponents} from '@/components/mdx-components'
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
      <div className="absolute inset-0 opacity-[0.03]">
        <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="article-grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#article-grid)" />
        </svg>
      </div>
      <div className="absolute -top-16 -right-16 h-64 w-64 rounded-full bg-current opacity-[0.03]" />
      <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-current opacity-[0.03]" />
      <div className="relative flex flex-col items-center gap-4">
        <div className={`${colors.accent} opacity-30`}>
          <FileText className="h-20 w-20" strokeWidth={1} />
        </div>
        {categoryName && (
          <span className={`${colors.accent} text-lg font-medium opacity-50`}>
            {categoryName}
          </span>
        )}
      </div>
    </div>
  )
}

interface BlogArticleProps {
  post: UnifiedBlogPost
  locale: string
  relatedPosts?: UnifiedBlogPost[]
  translations: {
    backToBlog: string
    publishedOn: string
    updatedOn: string
    share: string
    comment: string
    author: string
    writtenBy: string
    relatedArticles: string
    readMore: string
    views: string
    likes: string
  }
}

export function BlogArticle({
  post,
  locale,
  relatedPosts = [],
  translations,
}: BlogArticleProps) {
  const formatDate = (date: Date | null | undefined) => {
    if (!date) return ''
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(date))
  }

  return (
    <article className="mx-auto max-w-4xl">
      <header className="mb-8">
        <div className="mb-6 flex items-center justify-between">
          <Button variant="ghost" size="sm" className="-ml-2" asChild>
            <Link href="/blog">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {translations.backToBlog}
            </Link>
          </Button>
          {post.category && (
            <Badge variant="secondary" className="px-3 py-1">
              {post.category.name}
            </Badge>
          )}
        </div>

        <h1 className="mb-6 text-3xl leading-tight font-bold tracking-tight md:text-4xl lg:text-5xl">
          {post.title}
        </h1>

        {post.description && (
          <p className="text-muted-foreground mb-6 text-lg leading-relaxed md:text-xl">
            {post.description}
          </p>
        )}

        {post.hashtags && post.hashtags.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {post.hashtags.map((hashtag) => (
              <Badge key={hashtag} variant="outline" className="text-xs">
                #{hashtag}
              </Badge>
            ))}
          </div>
        )}

        <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-sm">
          {post.author && (
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={post.author.image || ''}
                  alt={post.author.name || ''}
                />
                <AvatarFallback>
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <span className="text-foreground font-medium">
                {post.author.name}
              </span>
            </div>
          )}
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
              <LikeButton postId={post.id} initialLikes={post.nbLike} />
            </>
          )}
        </div>
      </header>

      <div className="relative mb-10 aspect-video overflow-hidden rounded-2xl">
        {post.image ? (
          <Image
            src={post.image}
            alt={post.title}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <ImagePlaceholder categoryName={post.category?.name} />
        )}
      </div>

      <div className="prose prose-lg prose-gray dark:prose-invert prose-headings:text-foreground prose-headings:font-bold prose-headings:tracking-tight prose-h2:mt-10 prose-h2:mb-4 prose-h2:text-2xl prose-h3:mt-8 prose-h3:mb-3 prose-h3:text-xl prose-p:text-muted-foreground prose-p:leading-relaxed prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-strong:text-foreground prose-code:bg-muted prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sm prose-pre:bg-muted prose-pre:border prose-blockquote:border-l-primary prose-blockquote:bg-muted/50 prose-blockquote:py-1 prose-blockquote:not-italic prose-img:rounded-xl prose-img:shadow-lg max-w-none">
        <MDXRemote
          source={post.content}
          components={mdxComponents}
          options={{
            mdxOptions: {
              remarkPlugins: [remarkGfm],
              rehypePlugins: [
                [
                  rehypeShiki,
                  {
                    themes: {
                      light: 'github-dark',
                      dark: 'github-dark',
                    },
                    langs: [
                      'javascript',
                      'typescript',
                      'jsx',
                      'tsx',
                      'css',
                      'json',
                      'bash',
                      'html',
                      'markdown',
                    ],
                  },
                ],
              ],
            },
          }}
        />
      </div>

      {post.author && (
        <Card className="mt-12">
          <CardHeader>
            <CardDescription>{translations.writtenBy}</CardDescription>
          </CardHeader>
          <CardContent className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage
                src={post.author.image || ''}
                alt={post.author.name || ''}
              />
              <AvatarFallback className="text-lg">
                {post.author.name
                  ?.split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase() || 'A'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <CardTitle className="mb-1 text-lg">{post.author.name}</CardTitle>
              <CardDescription>{translations.author}</CardDescription>
            </div>
          </CardContent>
        </Card>
      )}

      <footer className="border-border mt-12 border-t pt-8">
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground text-sm">
            {translations.publishedOn}{' '}
            {formatDate(post.publishedAt || post.createdAt)}
            {post.updatedAt &&
              post.createdAt &&
              post.updatedAt.getTime() !== post.createdAt.getTime() && (
                <span>
                  {' '}
                  • {translations.updatedOn} {formatDate(post.updatedAt)}
                </span>
              )}
          </div>
          <div className="flex space-x-4">
            <button className="text-muted-foreground hover:text-foreground text-sm transition-colors">
              {translations.share}
            </button>
            <button className="text-muted-foreground hover:text-foreground text-sm transition-colors">
              {translations.comment}
            </button>
          </div>
        </div>
      </footer>

      {relatedPosts.length > 0 && (
        <RelatedArticles
          posts={relatedPosts}
          locale={locale}
          translations={{
            title: translations.relatedArticles,
            readMore: translations.readMore,
          }}
        />
      )}
    </article>
  )
}
