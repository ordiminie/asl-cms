'use client'

import {FileText, Hash, Search} from 'lucide-react'
import {useRouter} from 'next/navigation'
import {useCallback, useEffect, useState} from 'react'

import {searchDocsAction} from '@/app/[locale]/docs/actions'
import {Dialog, DialogContent, DialogTitle} from '@/components/ui/dialog'

import {Input} from '../../ui/input'

export interface SearchResult {
  id: string
  title: string
  content: string
  type: 'page' | 'section'
  url: string
  slug: string
}

interface SearchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SearchModal({open, onOpenChange}: SearchModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const router = useRouter()

  // Real search function using our search service
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)

    try {
      // Use our server action for search
      const searchResults = await searchDocsAction(searchQuery, 'en')
      setResults(searchResults)
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  // Debounce search to avoid too many calls
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(query)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [query, performSearch])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onOpenChange(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onOpenChange])

  const handleResultClick = (url: string) => {
    router.push(url)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0 [&>button]:hidden">
        <DialogTitle className="sr-only">Search documentation</DialogTitle>
        <div className="border-b">
          <div className="flex items-center px-4">
            <Search className="text-muted-foreground mr-3 h-4 w-4" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search documentation..."
              className="placeholder:text-muted-foreground h-14 flex-1 border-0 bg-transparent text-base focus-visible:ring-0 focus-visible:ring-offset-0"
              autoFocus
            />
            <kbd className="bg-muted text-muted-foreground pointer-events-none inline-flex h-5 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium select-none">
              <span className="text-xs">Esc</span>
            </kbd>
          </div>
        </div>

        {results.length > 0 && (
          <div className="max-h-[400px] overflow-y-auto">
            {results.map((result) => (
              <button
                key={result.id}
                onClick={() => handleResultClick(result.url)}
                className="hover:bg-muted/50 focus:bg-muted/50 w-full px-4 py-3 text-left transition-colors focus:outline-none"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {result.type === 'page' ? (
                      <FileText className="text-muted-foreground h-4 w-4" />
                    ) : (
                      <Hash className="text-muted-foreground h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{result.title}</div>
                    <div className="text-muted-foreground truncate text-sm">
                      {result.content}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {isSearching && (
          <div className="text-muted-foreground p-8 text-center text-sm">
            Searching...
          </div>
        )}

        {!isSearching && query && results.length === 0 && (
          <div className="text-muted-foreground p-8 text-center text-sm">
            No results found for &quot;{query}&quot;
          </div>
        )}

        {!isSearching && !query && (
          <div className="text-muted-foreground p-8 text-center text-sm">
            Start typing to search documentation
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
