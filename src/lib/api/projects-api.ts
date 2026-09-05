import {
  CreateProject,
  ProjectDTO,
  UpdateProject,
} from '@/services/types/domain/project-types'

import {apiClient} from './api-client'

// Types pour les réponses API
export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

// Fonctions API
export const projectsApi = {
  // GET /api/projects - Liste avec pagination
  getProjects: async (params: {
    page?: number
    limit?: number
    search?: string
    organizationId?: string
  }): Promise<PaginatedResponse<ProjectDTO>> => {
    const searchParams = new URLSearchParams()

    if (params.page) searchParams.append('page', params.page.toString())
    if (params.limit) searchParams.append('limit', params.limit.toString())
    if (params.search) searchParams.append('search', params.search)
    if (params.organizationId)
      searchParams.append('organizationId', params.organizationId)

    return apiClient<PaginatedResponse<ProjectDTO>>(
      `/api/projects?${searchParams}`
    )
  },

  // GET /api/projects/:id - Projet par ID
  getProject: async (id: string): Promise<ApiResponse<ProjectDTO>> => {
    return apiClient<ApiResponse<ProjectDTO>>(`/api/projects/${id}`)
  },

  // POST /api/projects - Créer un projet
  createProject: async (
    data: CreateProject
  ): Promise<ApiResponse<ProjectDTO>> => {
    return apiClient<ApiResponse<ProjectDTO>>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  // PUT /api/projects/:id - Modifier un projet
  updateProject: async (
    id: string,
    data: Partial<UpdateProject>
  ): Promise<ApiResponse<ProjectDTO>> => {
    return apiClient<ApiResponse<ProjectDTO>>(`/api/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  // DELETE /api/projects/:id - Supprimer un projet
  deleteProject: async (id: string): Promise<ApiResponse<void>> => {
    return apiClient<ApiResponse<void>>(`/api/projects/${id}`, {
      method: 'DELETE',
    })
  },
}
