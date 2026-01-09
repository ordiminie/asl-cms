'use client'

import {useCallback, useEffect, useRef, useState} from 'react'

export interface UseInfiniteScrollOptions<T> {
  initialData: T[]
  initialHasMore: boolean
  fetchMore: (offset: number) => Promise<{data: T[]; hasMore: boolean}>
  pageSize: number
  enabled?: boolean
}

export interface UseInfiniteScrollResult<T> {
  items: T[]
  isLoading: boolean
  hasMore: boolean
  loadMore: () => void
  reset: (newInitialData: T[], newHasMore: boolean) => void
  sentinelRef: React.RefCallback<HTMLDivElement>
}

export function useInfiniteScroll<T>({
  initialData,
  initialHasMore,
  fetchMore,
  pageSize,
  enabled = true,
}: UseInfiniteScrollOptions<T>): UseInfiniteScrollResult<T> {
  const [items, setItems] = useState<T[]>(initialData)
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const sentinelNodeRef = useRef<HTMLDivElement | null>(null)
  const isFetchingRef = useRef(false)

  // Use refs for values that change frequently to avoid recreating the observer
  const stateRef = useRef({
    hasMore,
    isLoading,
    enabled,
    itemsLength: items.length,
  })
  stateRef.current = {hasMore, isLoading, enabled, itemsLength: items.length}

  const fetchMoreRef = useRef(fetchMore)
  fetchMoreRef.current = fetchMore

  const loadMore = useCallback(async () => {
    const {hasMore, isLoading, enabled, itemsLength} = stateRef.current
    if (isFetchingRef.current || !hasMore || !enabled || isLoading) return

    isFetchingRef.current = true
    setIsLoading(true)

    try {
      const result = await fetchMoreRef.current(itemsLength)
      setItems((prev) => [...prev, ...result.data])
      setHasMore(result.hasMore)
    } catch (error) {
      console.error('Error loading more items:', error)
    } finally {
      setIsLoading(false)
      isFetchingRef.current = false
    }
  }, [])

  const reset = useCallback((newInitialData: T[], newHasMore: boolean) => {
    setItems(newInitialData)
    setHasMore(newHasMore)
    isFetchingRef.current = false
    setIsLoading(false)
  }, [])

  // Setup observer once when enabled changes
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    if (!enabled) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const {hasMore, isLoading} = stateRef.current
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore()
        }
      },
      {
        root: null,
        rootMargin: '100px',
        threshold: 0,
      }
    )

    if (sentinelNodeRef.current) {
      observerRef.current.observe(sentinelNodeRef.current)
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [enabled, loadMore])

  // Stable callback ref that only updates the node reference
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      sentinelNodeRef.current = node

      if (observerRef.current) {
        observerRef.current.disconnect()
        if (node) {
          observerRef.current.observe(node)
          // Check immediately if sentinel is already visible (not enough content to scroll)
          requestAnimationFrame(() => {
            const rect = node.getBoundingClientRect()
            const isVisible = rect.top < window.innerHeight + 100
            if (isVisible) {
              const {hasMore, isLoading} = stateRef.current
              if (hasMore && !isLoading && !isFetchingRef.current) {
                loadMore()
              }
            }
          })
        }
      }
    },
    [loadMore]
  )

  return {
    items,
    isLoading,
    hasMore,
    loadMore,
    reset,
    sentinelRef,
  }
}
