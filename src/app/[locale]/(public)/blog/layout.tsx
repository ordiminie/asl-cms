import {FolderOpen} from 'lucide-react'
import Link from 'next/link'
import {notFound} from 'next/navigation'
import {getTranslations} from 'next-intl/server'
import React from 'react'

import {getAllBlogCategoriesDal} from '@/app/dal/blog-dal'
import {NewsletterForm} from '@/components/features/blog/newsletter-form'
import {Badge} from '@/components/ui/badge'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
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

  const categories = await getAllBlogCategoriesDal(locale)

  return (
    <div className="bg-background mx-auto min-h-screen max-w-7xl">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          <main className="lg:col-span-3">{children}</main>

          <aside className="space-y-6 lg:col-span-1">
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
                      key={category.slug}
                      href={`/${locale}/blog/category/${category.slug}`}
                      className="text-muted-foreground hover:text-foreground group flex items-center justify-between transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4" />
                        <span className="group-hover:underline">
                          {category.name}
                        </span>
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {category.count}
                      </Badge>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            )}

            <NewsletterForm />
          </aside>
        </div>
      </div>
    </div>
  )
}
