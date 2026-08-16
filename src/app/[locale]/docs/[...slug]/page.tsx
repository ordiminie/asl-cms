import fs from 'fs'
import matter from 'gray-matter'
import type {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {connection} from 'next/server'
import {Suspense} from 'react'

import {MDXContent} from '@/components/mdx-content'
import {env} from '@/env'
import {routing} from '@/i18n/routing'
import {
  type DocItem,
  findDocBySlug,
  getDocFilePath,
  getDocsStructure,
} from '@/lib/files/docs-file-helper'

interface DocsPageProps {
  params: Promise<{
    slug: string[]
    locale: string
  }>
}

function getAllSlugsFromStructure(items: DocItem[]): string[] {
  const slugs: string[] = []

  for (const item of items) {
    slugs.push(item.slug)

    if (item.children) {
      slugs.push(...getAllSlugsFromStructure(item.children))
    }
  }

  return slugs
}

export async function generateStaticParams() {
  const params: {locale: string; slug: string[]}[] = []

  for (const locale of routing.locales) {
    try {
      const structure = getDocsStructure(locale)
      const slugs = getAllSlugsFromStructure(structure.items)

      if (slugs.length > 0) {
        for (const slug of slugs) {
          params.push({
            locale,
            slug: slug.split('/'),
          })
        }
      }
    } catch (error) {
      console.warn(
        `Failed to generate static params for locale ${locale}:`,
        error
      )
    }
  }

  return params
}

export async function generateMetadata({
  params,
}: DocsPageProps): Promise<Metadata> {
  const resolvedParams = await params
  const slug = resolvedParams.slug.join('/')
  const locale = resolvedParams.locale
  const docItem = findDocBySlug(slug, locale)

  if (!docItem) {
    return {
      title: 'Page not found',
      description: 'The requested documentation page could not be found.',
    }
  }

  const filePath = getDocFilePath(slug, locale)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let frontmatter: any = {}

  if (filePath && fs.existsSync(filePath)) {
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    const {data} = matter(fileContent)
    frontmatter = data
  }

  const title = frontmatter.title || docItem.title || 'Documentation'
  const description =
    frontmatter.description || docItem.description || 'ShipSaaS Documentation'

  const siteUrl = env.NEXT_PUBLIC_APP_URL || 'https://ship-saas.now'
  const ogImage = `${siteUrl}/shipsaas/shipsaas.png`
  const pageUrl = `${siteUrl}/${locale}/docs/${slug}`

  // Keywords from frontmatter or default SEO keywords
  const keywords =
    frontmatter.keywords ||
    'ShipSaaS documentation, Next.js docs, SaaS boilerplate guide, React tutorial, TypeScript guide, Stripe integration, Auth documentation'

  return {
    title: `${title} | ShipSaaS Documentation`,
    description,
    keywords,
    authors: [{name: 'ShipSaaS'}],
    openGraph: {
      title: `${title} | ShipSaaS Documentation`,
      description,
      type: 'article',
      url: pageUrl,
      siteName: 'ShipSaaS',
      locale,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${title} - ShipSaaS Documentation`,
        },
      ],
      ...(frontmatter.publishedTime && {
        publishedTime: frontmatter.publishedTime,
      }),
      ...(frontmatter.modifiedTime && {
        modifiedTime: frontmatter.modifiedTime,
      }),
      ...(frontmatter.authors && {
        authors: frontmatter.authors,
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | ShipSaaS Docs`,
      description,
      images: [ogImage],
      creator: '@shipsaas',
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    alternates: {
      canonical: pageUrl,
      languages: {
        fr: `${siteUrl}/fr/docs/${slug}`,
        en: `${siteUrl}/en/docs/${slug}`,
        es: `${siteUrl}/es/docs/${slug}`,
      },
    },
  }
}

export default async function DocsPage({params}: DocsPageProps) {
  const resolvedParams = await params
  const slug = resolvedParams.slug.join('/')
  const docItem = findDocBySlug(slug, resolvedParams.locale)

  if (!docItem) {
    notFound()
  }

  const filePath = getDocFilePath(slug, resolvedParams.locale)
  let content = ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let frontmatter: any = {}

  if (filePath && fs.existsSync(filePath)) {
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    const {data, content: mdxContent} = matter(fileContent)
    frontmatter = data
    content = mdxContent
  }

  if (!content) {
    return (
      <div className="max-w-4xl">
        <div className="prose prose-gray dark:prose-invert max-w-none">
          <h1>{docItem.title}</h1>
          <p className="text-muted-foreground">Contenu à venir...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-4xl">
      {/* Title from frontmatter */}
      {frontmatter.title && (
        <h1 className="border-border mb-6 scroll-mt-20 border-b pb-2 text-2xl font-bold sm:text-3xl md:text-4xl">
          {frontmatter.title}
        </h1>
      )}

      <Suspense fallback={<DocsContentSkeleton />}>
        <DocsContent content={content} />
      </Suspense>
    </div>
  )
}

/**
 * La compilation MDX lit l'horloge, ce qui est interdit au prerender. Isolée
 * ici pour que le reste de la page — titre, fil d'ariane, sidebar, sommaire —
 * se prerende quand même. Même remède que pour l'article de blog, voir D15.
 */
async function DocsContent({content}: {content: string}) {
  // <Suspense> seul ne suffit pas : l'IO synchrone casse le prerender quoi
  // qu'il arrive. connection() marque ce sous-arbre comme rendu à la requête.
  await connection()

  return <MDXContent source={content} />
}

function DocsContentSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="bg-muted h-4 w-full animate-pulse rounded" />
      <div className="bg-muted h-4 w-11/12 animate-pulse rounded" />
      <div className="bg-muted h-4 w-4/5 animate-pulse rounded" />
      <div className="bg-muted h-32 w-full animate-pulse rounded-lg" />
    </div>
  )
}
