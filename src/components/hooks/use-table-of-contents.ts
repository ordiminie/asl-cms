'use client'

import {useEffect, useState} from 'react'

export interface TocItem {
  id: string
  text: string
  level: number
}

/**
 * Suit le titre en cours de lecture.
 *
 * Les titres eux-mêmes viennent du serveur : les lire dans le DOM ne marche
 * plus depuis que le contenu MDX est streamé, l'effet s'exécutant avant son
 * arrivée sans que rien ne le relance ensuite. Pour la même raison, les
 * ancres à observer peuvent manquer au montage : on attend qu'elles arrivent.
 */
export function useActiveHeading(ids: string[]): string {
  const [activeId, setActiveId] = useState<string>('')
  const key = ids.join(',')

  useEffect(() => {
    const headingIds = key ? key.split(',') : []
    if (headingIds.length === 0) return

    let intersection: IntersectionObserver | undefined

    const observeHeadings = () => {
      const headings = headingIds
        .map((id) => document.getElementById(id))
        .filter((element): element is HTMLElement => element !== null)

      if (headings.length === 0) return false

      intersection?.disconnect()
      intersection = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              setActiveId(entry.target.id)
            }
          }
        },
        {rootMargin: '-80px 0% -80% 0%', threshold: 0}
      )
      for (const heading of headings) {
        intersection.observe(heading)
      }

      return headings.length === headingIds.length
    }

    if (observeHeadings()) {
      return () => intersection?.disconnect()
    }

    const mutation = new MutationObserver(() => {
      if (observeHeadings()) mutation.disconnect()
    })
    mutation.observe(document.body, {childList: true, subtree: true})

    return () => {
      mutation.disconnect()
      intersection?.disconnect()
    }
  }, [key])

  return activeId
}
