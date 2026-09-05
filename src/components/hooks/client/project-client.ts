//all react-qyery hook for project entity

import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {toast} from 'sonner'

import {projectsApi} from '@/lib/api/projects-api'
import {
  CreateProject,
  UpdateProject,
} from '@/services/types/domain/project-types'

// Clés de requête (Query Keys)
export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (params: Record<string, unknown>) =>
    [...projectKeys.lists(), params] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
}

// Hook pour récupérer la liste des projets
export function useProjects(params: {
  page?: number
  limit?: number
  search?: string
  organizationId?: string
}) {
  return useQuery({
    queryKey: projectKeys.list(params),
    queryFn: () => projectsApi.getProjects(params),
    placeholderData: (previousData) => previousData, // Garde les données précédentes pendant le chargement
  })
}

// Hook pour récupérer un projet par ID
export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => projectsApi.getProject(id),
    enabled: !!id, // Ne s'exécute que si l'ID est fourni
  })
}

// Hook pour créer un projet
export function useCreateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateProject) => projectsApi.createProject(data),
    onSuccess: (response) => {
      // Invalider et refetch les listes de projets
      queryClient.invalidateQueries({queryKey: projectKeys.lists()})

      toast.success(response.message || 'Projet créé avec succès')
    },
    onError: (error: unknown) => {
      const message =
        error && typeof error === 'object' && 'message' in error
          ? (error.message as string)
          : 'Erreur lors de la création du projet'
      toast.error(message)
    },
  })
}

// Hook pour modifier un projet
export function useUpdateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({id, data}: {id: string; data: Partial<UpdateProject>}) =>
      projectsApi.updateProject(id, data),
    onSuccess: (response, variables) => {
      // Invalider les listes et le détail du projet modifié
      queryClient.invalidateQueries({queryKey: projectKeys.lists()})
      queryClient.invalidateQueries({
        queryKey: projectKeys.detail(variables.id),
      })

      toast.success(response.message || 'Projet mis à jour avec succès')
    },
    onError: (error: unknown) => {
      const message =
        error && typeof error === 'object' && 'message' in error
          ? (error.message as string)
          : 'Erreur lors de la mise à jour du projet'
      toast.error(message)
    },
  })
}

// Hook pour supprimer un projet
export function useDeleteProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => projectsApi.deleteProject(id),
    onSuccess: (response) => {
      // Invalider toutes les listes de projets
      queryClient.invalidateQueries({queryKey: projectKeys.lists()})

      toast.success(response.message || 'Projet supprimé avec succès')
    },
    onError: (error: unknown) => {
      const message =
        error && typeof error === 'object' && 'message' in error
          ? (error.message as string)
          : 'Erreur lors de la suppression du projet'
      toast.error(message)
    },
  })
}

// Hook utilitaire pour précharger un projet
export function usePrefetchProject() {
  const queryClient = useQueryClient()

  return (id: string) => {
    queryClient.prefetchQuery({
      queryKey: projectKeys.detail(id),
      queryFn: () => projectsApi.getProject(id),
      staleTime: 60 * 1000, // 1 minute
    })
  }
}
