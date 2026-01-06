'use client'

import {usePathname} from 'next/navigation'
import {useEffect, useLayoutEffect, useState} from 'react'

export interface TocItem {
  id: string
  text: string
  level: number
}

export function useTableOfContents() {
  const [toc, setToc] = useState<TocItem[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const pathname = usePathname()

  // Use layoutEffect to synchronize with DOM updates
  useLayoutEffect(() => {
    const updateToc = () => {
      // Extract headings from the DOM
      const headings = Array.from(
        document.querySelectorAll('h1, h2, h3, h4')
      ).filter((heading) => heading.id) // Only include headings with IDs

      const tocItems: TocItem[] = headings.map((heading) => ({
        id: heading.id,
        text: heading.textContent || '',
        level: parseInt(heading.tagName.charAt(1)),
      }))

      setToc(tocItems)
      setActiveId('') // Reset active ID
    }

    updateToc()
  }, [pathname])

  // Separate useEffect for intersection observer
  useEffect(() => {
    if (toc.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        }
      },
      {
        rootMargin: '-80px 0% -80% 0%', // Offset for header and better UX
        threshold: 0,
      }
    )

    // Observe all headings
    const headings = toc
      .map((item) => document.getElementById(item.id))
      .filter(Boolean)
    for (const heading of headings) {
      observer.observe(heading as Element)
    }

    // Cleanup observer
    return () => {
      observer.disconnect()
    }
  }, [toc])

  return {toc, activeId}
}
