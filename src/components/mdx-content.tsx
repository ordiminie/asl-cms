import rehypeShiki from '@shikijs/rehype'
import {connection} from 'next/server'
import {MDXRemote} from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import type {ShikiTransformer} from 'shiki'

import {mdxComponents} from './mdx-components'

/**
 * Shiki ne reporte pas le langage dans le HTML : le transformer le lit dans le
 * contexte de compilation pour que l'en-tête du bloc puisse l'afficher.
 */
const exposeLanguage: ShikiTransformer = {
  name: 'expose-language',
  pre(node) {
    node.properties['data-language'] = this.options.lang
  },
}

interface MDXContentProps {
  source: string
}

/**
 * Rendu unique du MDX, partagé par la documentation et le blog.
 *
 * La compilation MDX (next-mdx-remote + rehypeShiki) lit l'horloge : elle ne
 * peut pas être prerendue. connection() marque le sous-arbre comme rendu à la
 * requête, ce qui impose aux appelants de l'envelopper d'un <Suspense>.
 */
export async function MDXContent({source}: MDXContentProps) {
  await connection()

  return (
    <div className="prose prose-gray dark:prose-invert prose-headings:text-foreground prose-a:text-link prose-strong:text-foreground prose-code:text-foreground prose-code:before:content-none prose-code:after:content-none prose-pre:bg-transparent prose-pre:p-0 w-full max-w-none overflow-x-hidden">
      <MDXRemote
        source={source}
        components={mdxComponents}
        options={{
          mdxOptions: {
            remarkPlugins: [remarkGfm],
            rehypePlugins: [
              [
                rehypeShiki,
                {
                  themes: {light: 'github-light', dark: 'github-dark'},
                  defaultColor: false,
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
                    'sql',
                    'ts',
                    'js',
                  ],
                  parseMetaString: (metaString: string) => {
                    const match = metaString.match(/title="([^"]*)"/)
                    return match ? {title: match[1]} : {}
                  },
                  transformers: [exposeLanguage],
                },
              ],
            ],
          },
        }}
      />
    </div>
  )
}
