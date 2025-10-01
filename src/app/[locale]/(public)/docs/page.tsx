import type {Metadata} from 'next'
import Link from 'next/link'
import {notFound} from 'next/navigation'

import {env, PagesConst} from '@/env'
import {getRulesByCategory} from '@/lib/helper/docs.server'
import {isPageEnabled} from '@/lib/utils'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Documentation des Règles de Développement',
    description:
      'Découvrez toutes les règles et conventions de développement du projet',
  }
}

export default async function DocsPage() {
  if (!isPageEnabled(PagesConst.DOCS) || env.NODE_ENV !== 'development') {
    return notFound()
  }

  const rulesByCategory = getRulesByCategory()
  const categories = Object.keys(rulesByCategory)

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-6xl">
          {/* En-tête de la page */}
          <header className="mb-12 text-center">
            <h1 className="text-foreground mb-4 text-4xl font-bold">
              Documentation des Règles
            </h1>
            <p className="text-muted-foreground mx-auto max-w-2xl text-xl">
              Explorez toutes les règles et conventions de développement
              organisées par catégorie
            </p>
          </header>

          {/* Navigation par catégorie */}
          <nav className="mb-8">
            <div className="flex flex-wrap justify-center gap-4">
              {categories.map((category) => (
                <a
                  key={category}
                  href={`#${category.toLowerCase().replace(/\s+/g, '-')}`}
                  className="border-border bg-card hover:bg-muted rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
                >
                  {category} ({rulesByCategory[category].length})
                </a>
              ))}
            </div>
          </nav>

          {/* Liste des règles par catégorie */}
          <div className="space-y-12">
            {categories.map((category) => (
              <section
                key={category}
                id={category.toLowerCase().replace(/\s+/g, '-')}
                className="scroll-mt-8"
              >
                <h2 className="text-foreground mb-6 border-b pb-2 text-2xl font-semibold">
                  {category}
                </h2>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {rulesByCategory[category].map((rule) => (
                    <article
                      key={rule.slug}
                      className="border-border bg-card hover:bg-muted/50 rounded-lg border p-6 transition-colors"
                    >
                      <h3 className="mb-3 text-lg font-semibold">
                        <Link
                          href={`/docs/${rule.slug}`}
                          className="text-foreground hover:text-primary transition-colors"
                        >
                          {rule.title}
                        </Link>
                      </h3>

                      {rule.description && (
                        <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
                          {rule.description}
                        </p>
                      )}

                      <div className="text-muted-foreground flex flex-wrap gap-2 text-xs">
                        {rule.globs && (
                          <span className="bg-muted rounded px-2 py-1">
                            {rule.globs}
                          </span>
                        )}
                        {rule.alwaysApply && (
                          <span className="rounded bg-blue-100 px-2 py-1 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                            Toujours appliqué
                          </span>
                        )}
                        <span className="ml-auto">{rule.readTime}</span>
                      </div>

                      <div className="mt-4">
                        <Link
                          href={`/docs/${rule.slug}`}
                          className="hover:text-foreground text-sm font-medium transition-colors"
                        >
                          Lire la règle →
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Message si aucune règle */}
          {categories.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-muted-foreground text-lg">
                Aucune règle disponible pour le moment.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
