import rehypeShiki from '@shikijs/rehype'
import {MDXRemote} from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'

import {LikeButton} from '@/components/features/blog/like-button'
import {mdxComponents} from '@/components/mdx-components'
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar'
import {Badge} from '@/components/ui/badge'
import {UnifiedBlogPost} from '@/services/types/domain/blog-types'

interface BlogArticleProps {
  post: UnifiedBlogPost
  locale: string
  translations: {
    publishedOn: string
    updatedOn: string
    share: string
    comment: string
    author: string
  }
}

export function BlogArticle({post, locale, translations}: BlogArticleProps) {
  const formatDate = (date: Date | null | undefined) => {
    if (!date) return ''
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(date))
  }

  return (
    <div>
      <header className="mb-12">
        <div className="mb-6 flex items-center gap-4">
          <Badge variant="outline">
            {post.category?.name || 'Sans catégorie'}
          </Badge>
          <span className="text-muted-foreground text-sm">
            {formatDate(post.publishedAt || post.createdAt)}
          </span>
          {post.source === 'database' && (
            <>
              <span className="text-muted-foreground text-sm">
                {post.nbView} vues
              </span>
              <LikeButton postId={post.id} initialLikes={post.nbLike} />
            </>
          )}
        </div>

        <h1 className="text-foreground mb-6 text-4xl leading-tight font-bold">
          {post.title}
        </h1>

        {post.description && (
          <p className="text-muted-foreground text-xl leading-relaxed">
            {post.description}
          </p>
        )}

        {post.hashtags && post.hashtags.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {post.hashtags.map((hashtag) => (
              <Badge key={hashtag} variant="secondary">
                #{hashtag}
              </Badge>
            ))}
          </div>
        )}

        {post.author && (
          <div className="border-border mt-8 border-t pt-6">
            <div className="flex items-center gap-3">
              <Avatar className="size-10">
                <AvatarImage
                  src={post.author.image || ''}
                  alt={post.author.name || 'Auteur'}
                />
                <AvatarFallback>
                  {post.author.name
                    ?.split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase() || 'A'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{post.author.name}</p>
                <p className="text-muted-foreground text-sm">
                  {translations.author}
                </p>
              </div>
            </div>
          </div>
        )}
      </header>

      <article className="prose prose-lg prose-gray dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground prose-a:text-primary prose-strong:text-foreground prose-code:text-foreground prose-pre:bg-muted prose-blockquote:border-l-primary max-w-none">
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
      </article>

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
    </div>
  )
}
