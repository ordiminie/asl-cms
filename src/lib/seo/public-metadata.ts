import 'server-only'

import type {Metadata} from 'next'

import {getCurrentAssociationSeoDal} from '@/app/dal/seo-dal'

import {
  AssociationSeoContext,
  ResolvedSeo,
  toPageMetadata,
} from './resolve-metadata'

/**
 * Metadonnees d'une page publique de l'association du domaine appele (s11) :
 * `resolve` applique la chaine de repli propre a la page, a partir des
 * donnees de l'association. Sans association, `fallback`.
 */
export const publicPageMetadata = async (
  resolve: (association: AssociationSeoContext) => ResolvedSeo,
  options: {
    absoluteTitle?: boolean
    type?: 'website' | 'article'
    fallback?: Metadata
  } = {}
): Promise<Metadata> => {
  const association = await getCurrentAssociationSeoDal()
  if (!association) return options.fallback ?? {}

  return toPageMetadata(resolve(association), association.name, options)
}
