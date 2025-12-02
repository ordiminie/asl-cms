import rehypeShiki from '@shikijs/rehype'
import type {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {MDXRemote} from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'

import {
  getAllPublishedPostSlugsDal,
  getPublishedPostBySlugDal,
} from '@/app/dal/post-dal'
import {LikeButton} from '@/components/features/blog/like-button'
import {mdxComponents} from '@/components/mdx-components'
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar'
import {Badge} from '@/components/ui/badge'
import {PagesConst} from '@/env'
import {isPageEnabled} from '@/lib/utils'

export const dynamic = 'force-static'

export async function generateStaticParams() {
  if (!isPageEnabled(PagesConst.BLOG)) {
    return []
  }

  try {
    const slugs = await getAllPublishedPostSlugsDal()
    return slugs.map(({slug, language}) => ({
      locale: language,
      slug: slug,
    }))
  } catch {
    return []
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string; slug: string}>
}): Promise<Metadata> {
  const {locale, slug} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'BlogPostPage'})

  try {
    const post = await getPublishedPostBySlugDal(slug)

    // Trouver la traduction pour la langue actuelle
    const translation = post.postTranslations?.find(
      (t) => t.language === locale
    )

    if (!translation) {
      return {
        title: 'Article non trouvé',
        description: "Cet article n'existe pas.",
      }
    }

    return {
      title: `${translation.title} | ${t('meta.title')}`,
      description: translation.description || translation.title,
      keywords: post.postHashtags
        ?.map((ph) => ph.hashtag?.name)
        .filter(Boolean)
        .join(', '),
      openGraph: {
        title: translation.title,
        description: translation.description || translation.title,
        type: 'article',
        publishedTime: post.createdAt?.toISOString(),
        authors: [post.author?.name || 'Anonymous'],
        tags: post.postHashtags
          ?.map((ph) => ph.hashtag?.name)
          .filter((name): name is string => Boolean(name)),
      },
    }
  } catch {
    return {
      title: 'Article non trouvé',
      description: "Cet article n'existe pas.",
    }
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{locale: string; slug: string}>
}) {
  if (!isPageEnabled(PagesConst.BLOG)) {
    return notFound()
  }
  const {locale, slug} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'BlogPostPage'})

  try {
    // Récupérer l'article par slug (toutes langues)
    const post = await getPublishedPostBySlugDal(slug)

    // Trouver la traduction pour la langue actuelle ou la première disponible
    let translation = post.postTranslations?.find((t) => t.language === locale)

    // Si pas de traduction dans la langue actuelle, prendre la première disponible
    if (
      !translation &&
      post.postTranslations &&
      post.postTranslations.length > 0
    ) {
      translation = post.postTranslations[0]
    }

    if (!translation) {
      notFound()
    }

    const formatDate = (date: Date | null) => {
      if (!date) return ''
      return new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }).format(new Date(date))
    }

    return (
      <div>
        {/* En-tête de l'article */}
        <header className="mb-12">
          <div className="mb-6 flex items-center gap-4">
            <Badge variant="outline">
              {post.category?.name || 'Sans catégorie'}
            </Badge>
            <span className="text-muted-foreground text-sm">
              {formatDate(post.createdAt || null)}
            </span>
            <span className="text-muted-foreground text-sm">
              {post.nbView || 0} vues
            </span>
            <LikeButton postId={post.id} initialLikes={post.nbLike || 0} />
          </div>

          <h1 className="text-foreground mb-6 text-4xl leading-tight font-bold">
            {translation.title}
          </h1>

          {translation.description && (
            <p className="text-muted-foreground text-xl leading-relaxed">
              {translation.description}
            </p>
          )}

          {/* Hashtags */}
          {post.postHashtags && post.postHashtags.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {post.postHashtags.map((postHashtag) => (
                <Badge
                  key={postHashtag.hashtag?.id || postHashtag.hashtagId}
                  variant="secondary"
                >
                  #{postHashtag.hashtag?.name || 'hashtag'}
                </Badge>
              ))}
            </div>
          )}

          {/* Informations sur l'auteur */}
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
                  <p className="text-muted-foreground text-sm">Auteur</p>
                </div>
              </div>
            </div>
          )}
        </header>

        {/* Contenu MDX */}
        <article className="prose prose-lg prose-gray dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground prose-a:text-primary prose-strong:text-foreground prose-code:text-foreground prose-pre:bg-muted prose-blockquote:border-l-primary max-w-none">
          <MDXRemote
            source={translation.content || ''}
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

        {/* Pied de page de l'article */}
        <footer className="border-border mt-12 border-t pt-8">
          <div className="flex items-center justify-between">
            <div className="text-muted-foreground text-sm">
              {t('publishedOn')} {formatDate(post.createdAt)}
              {post.updatedAt && post.updatedAt !== post.createdAt && (
                <span>
                  {' '}
                  • {t('updatedOn')} {formatDate(post.updatedAt)}
                </span>
              )}
            </div>
            <div className="flex space-x-4">
              <button className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                {t('share')}
              </button>
              <button className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                {t('comment')}
              </button>
            </div>
          </div>
        </footer>
      </div>
    )
  } catch {
    // Post not found or other error
    notFound()
  }
}
