import {Eye, FileText, FolderOpen, PenTool, Shield, User} from 'lucide-react'
import Link from 'next/link'
import {notFound} from 'next/navigation'
import {getTranslations} from 'next-intl/server'
import React from 'react'

import {getAllCategoriesDal} from '@/app/dal/post-dal'
import {Badge} from '@/components/ui/badge'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {Separator} from '@/components/ui/separator'
import {PagesConst} from '@/env'
import {isPageEnabled} from '@/lib/utils'

export default async function BlogLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{locale: string}>
}) {
  if (!isPageEnabled(PagesConst.BLOG)) {
    return notFound()
  }
  const {locale} = await params
  const t = await getTranslations({locale, namespace: 'BlogLayout'})

  const categories = await getAllCategoriesDal()

  // Mock data pour les articles populaires et hashtags
  const popularPosts = [
    {
      id: '1',
      title: 'Guide complet de Next.js 15',
      slug: 'guide-nextjs-15',
      views: 1247,
    },
    {
      id: '2',
      title: 'React 19 : Nouvelles fonctionnalités',
      slug: 'react-19-nouveautes',
      views: 892,
    },
    {
      id: '3',
      title: 'TypeScript : Bonnes pratiques 2025',
      slug: 'typescript-bonnes-pratiques',
      views: 756,
    },
    {
      id: '4',
      title: 'Tailwind CSS v4 : Ce qui change',
      slug: 'tailwind-css-v4',
      views: 643,
    },
  ]

  const popularHashtags = [
    {name: 'react', count: 15},
    {name: 'nextjs', count: 12},
    {name: 'typescript', count: 10},
    {name: 'javascript', count: 8},
    {name: 'css', count: 6},
    {name: 'nodejs', count: 5},
    {name: 'tailwind', count: 4},
    {name: 'frontend', count: 3},
  ]

  return (
    <div className="bg-background mx-auto min-h-screen max-w-7xl">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          {/* Contenu principal */}
          <main className="lg:col-span-3">{children}</main>

          {/* Sidebar */}
          <aside className="space-y-6 lg:col-span-1">
            {/* Navigation du blog */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {t('navigation.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link
                  href="/blog"
                  className="text-muted-foreground hover:text-foreground flex items-center gap-2 py-1 transition-colors"
                >
                  <FileText className="h-4 w-4" />
                  {t('navigation.allArticles')}
                </Link>
                <Link
                  href="/blog/mdx"
                  className="text-muted-foreground hover:text-foreground flex items-center gap-2 py-1 transition-colors"
                >
                  <PenTool className="h-4 w-4" />
                  {t('navigation.mdxArticles')}
                </Link>
                <Separator className="my-3" />
                <Link
                  href="/admin/blog"
                  className="text-muted-foreground hover:text-foreground block py-1 transition-colors"
                >
                  {t('navigation.admin')}
                </Link>
              </CardContent>
            </Card>

            {/* Catégories */}
            {categories.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {t('categories.title')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {categories.map((category) => (
                    <Link
                      key={category.id}
                      href={`/blog?categoryId=${category.id}`}
                      className="text-muted-foreground hover:text-foreground group flex items-center justify-between transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4" />
                        <span className="group-hover:underline">
                          {category.name}
                        </span>
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {Math.floor(Math.random() * 10) + 1}
                      </Badge>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Articles les plus lus */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('popular.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {popularPosts.map((post, index) => (
                  <div key={post.id} className="group">
                    <div className="flex items-start gap-3">
                      <div className="bg-primary/10 text-primary flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-sm font-medium">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/blog/${post.slug}`}
                          className="text-foreground group-hover:text-primary line-clamp-2 block text-sm font-medium transition-colors"
                        >
                          {post.title}
                        </Link>
                        <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                          <Eye className="h-3 w-3" />
                          {post.views.toLocaleString()} {t('popular.views')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Hashtags populaires */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('hashtags.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {popularHashtags.map((hashtag) => (
                    <Link
                      key={hashtag.name}
                      href={`/blog?hashtag=${hashtag.name}`}
                      className="group"
                    >
                      <Badge
                        variant="outline"
                        className="hover:bg-primary hover:text-primary-foreground cursor-pointer transition-colors"
                      >
                        #{hashtag.name}
                        <span className="ml-1 text-xs opacity-60">
                          {hashtag.count}
                        </span>
                      </Badge>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Newsletter (fictive) */}
            <Card className="from-primary/5 to-primary/10 border-primary/20 bg-gradient-to-br">
              <CardHeader>
                <CardTitle className="text-lg">
                  {t('newsletter.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-muted-foreground text-sm">
                  {t('newsletter.description')}
                </p>
                <div className="flex flex-col gap-2">
                  <input
                    type="email"
                    placeholder={t('newsletter.placeholder')}
                    className="bg-background/50 rounded-md border px-3 py-2 text-sm backdrop-blur"
                  />
                  <button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-2 text-sm transition-colors">
                    {t('newsletter.subscribe')}
                  </button>
                </div>
                <p className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Shield className="h-3 w-3" />
                  {t('newsletter.privacy')}
                </p>
              </CardContent>
            </Card>

            {/* Statistiques (fictives) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('stats.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4" />
                    {t('stats.articles')}
                  </span>
                  <span className="font-medium">47</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2 text-sm">
                    <User className="h-4 w-4" />
                    {t('stats.authors')}
                  </span>
                  <span className="font-medium">12</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2 text-sm">
                    <FolderOpen className="h-4 w-4" />
                    {t('stats.categories')}
                  </span>
                  <span className="font-medium">{categories.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Eye className="h-4 w-4" />
                    {t('stats.totalViews')}
                  </span>
                  <span className="font-medium">15.2k</span>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  )
}
