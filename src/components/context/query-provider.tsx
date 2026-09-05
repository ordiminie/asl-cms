'use client'

import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {ReactQueryDevtools} from '@tanstack/react-query-devtools'
import React, {useState} from 'react'

interface QueryProviderProps {
  children: React.ReactNode
}

export function QueryProvider({children}: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            gcTime: 10 * 60 * 1000, // 10 minutes (anciennement cacheTime)
            retry: (failureCount, error) => {
              // Ne retry pas sur les erreurs 4xx
              if (error && typeof error === 'object' && 'status' in error) {
                const statusError = error as {status: number}
                if (statusError.status >= 400 && statusError.status < 500) {
                  return false
                }
              }
              return failureCount < 3
            },
          },
          mutations: {
            retry: 1,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
