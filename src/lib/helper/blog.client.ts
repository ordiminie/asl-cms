import {BlogPost} from './blog'

/**
 * Exemple bidon pour le pattern helper client server isomorphique
 * CF : .cursor/rules/00-generals/helper-rules.mdc
 */
export const blogStorage = {
  /**
   * Sauvegarde un article dans le localStorage
   */
  savePost: (post: BlogPost): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`blog-post-${post.slug}`, JSON.stringify(post))
    }
  },
}
