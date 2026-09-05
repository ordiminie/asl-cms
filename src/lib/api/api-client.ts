import {env} from '@/env'

// Configuration de base pour les appels API
const API_BASE_URL = env.NEXT_PUBLIC_API_URL || ''

export class ApiError extends Error {
  constructor(
    public message: string,
    public status: number,
    public statusText: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: globalThis.RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    throw new ApiError(
      `API Error: ${response.statusText}`,
      response.status,
      response.statusText
    )
  }

  return response.json()
}
