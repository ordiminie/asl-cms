'use client'

import {formatDistanceToNow} from 'date-fns'
import {fr} from 'date-fns/locale'
import {Edit, Folder, Loader2, Plus} from 'lucide-react'
import Link from 'next/link'
import {useRouter, useSearchParams} from 'next/navigation'
import {useCallback, useEffect} from 'react'
import {toast} from 'sonner'

import {
  deleteProjectAction,
  fetchProjectsAction,
  updateProjectAction,
} from '@/app/[locale]/(app)/team/[slug]/projects/actions'
import {useInfiniteScroll} from '@/components/hooks/use-infinite-scroll'
import {Avatar, AvatarFallback} from '@/components/ui/avatar'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {Project} from '@/services/types/domain/project-types'

import {DeleteProjectDialog} from './delete-project-dialog'
import {EditProjectDialog} from './edit-project-dialog'
import {ProjectsPagination} from './projects-pagination'
import {ProjectsToolbar} from './projects-toolbar'

const IS_INFINITE_SCROLL = true
const PAGE_SIZE = 2

interface Props {
  organizationId: string
  organizationSlug: string
  initialProjects: Project[]
  currentPage: number
  pageSize: number
  totalProjects: number
  permissions: {
    canCreate: boolean
    canEdit: boolean
    canDelete: boolean
    canManage: boolean
  }
  searchQuery: string
}

export default function ProjectsManagement({
  organizationId,
  organizationSlug,
  initialProjects,
  currentPage,
  pageSize,
  totalProjects,
  permissions,
  searchQuery,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleSearch = (search: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('search', search)
    params.set('page', '1')
    router.push(`?${params.toString()}`)
  }

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', page.toString())
    router.push(`?${params.toString()}`)
  }

  const handlePerPageChange = (limit: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('limit', limit)
    params.set('page', '1')
    router.push(`?${params.toString()}`)
  }

  // Infinite scroll logic
  const fetchMoreProjects = useCallback(
    async (offset: number) => {
      const result = await fetchProjectsAction({
        organizationId,
        limit: PAGE_SIZE,
        offset,
        search: searchQuery || undefined,
      })
      if (result.success && result.pagination) {
        return {
          data: result.data,
          hasMore: result.pagination.hasMore,
        }
      }
      return {data: [], hasMore: false}
    },
    [organizationId, searchQuery]
  )

  const {
    items: infiniteProjects,
    isLoading: isLoadingMore,
    hasMore,
    sentinelRef,
    reset,
  } = useInfiniteScroll({
    initialData: IS_INFINITE_SCROLL
      ? initialProjects.slice(0, PAGE_SIZE)
      : initialProjects,
    initialHasMore: IS_INFINITE_SCROLL ? totalProjects > PAGE_SIZE : false,
    fetchMore: fetchMoreProjects,
    pageSize: PAGE_SIZE,
    enabled: IS_INFINITE_SCROLL,
  })

  useEffect(() => {
    reset(initialProjects.slice(0, PAGE_SIZE), totalProjects > PAGE_SIZE)
  }, [initialProjects, totalProjects, reset])

  const projects = IS_INFINITE_SCROLL ? infiniteProjects : initialProjects

  return (
    <Card className="border-0 sm:border">
      <CardHeader className="px-4 sm:px-6">
        <div className="flex items-center justify-between">
          <CardTitle>Gestion des projets</CardTitle>
          {permissions.canCreate && (
            <Button asChild>
              <Link href={`/team/${organizationSlug}/projects/new`}>
                <Plus className="mr-2 h-4 w-4" />
                Nouveau projet
              </Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        <ProjectsToolbar
          onSearch={handleSearch}
          initialSearch={searchQuery}
          totalProjects={totalProjects}
          onPerPageChange={handlePerPageChange}
          perPage={pageSize.toString()}
          showPerPageSelector={!IS_INFINITE_SCROLL}
        />

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Projet</TableHead>
              <TableHead className="hidden xl:table-cell">
                Description
              </TableHead>
              <TableHead className="hidden lg:table-cell">Créé</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
              <TableRow key={project.id}>
                <TableCell className="flex items-center gap-2">
                  <Avatar className="size-8">
                    <AvatarFallback>
                      <Folder className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{project.name}</div>
                    <div className="text-muted-foreground text-sm xl:hidden">
                      {project.description || 'Aucune description'}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden xl:table-cell">
                  <div className="truncate">
                    {project.description || 'Aucune description'}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground hidden text-sm lg:table-cell">
                  {project.createdAt &&
                    formatDistanceToNow(new Date(project.createdAt), {
                      addSuffix: true,
                      locale: fr,
                    })}
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link
                        href={`/team/${organizationSlug}/projects/${project.id}/tasks`}
                      >
                        <Edit className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">
                          Gérer les tâches
                        </span>
                      </Link>
                    </Button>
                    {permissions.canEdit && (
                      <EditProjectDialog
                        project={project}
                        onSave={async (id, data) => {
                          const formData = new FormData()
                          formData.append('organizationId', organizationId)
                          formData.append('name', data.name)
                          if (data.description) {
                            formData.append('description', data.description)
                          }

                          const result = await updateProjectAction(
                            id,
                            undefined,
                            formData
                          )

                          if (result.success) {
                            toast.success(result.message)
                          } else {
                            toast.error(result.message)
                          }
                        }}
                      />
                    )}
                    {permissions.canDelete && (
                      <div className="hidden sm:block">
                        <DeleteProjectDialog
                          projectId={project.id}
                          projectName={project.name}
                          onDelete={async (id) => {
                            const result = await deleteProjectAction(id)

                            if (result.success) {
                              toast.success(result.message)
                            } else {
                              toast.error(result.message)
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Infinite Scroll Sentinel */}
        {IS_INFINITE_SCROLL && (hasMore || isLoadingMore) && (
          <div ref={sentinelRef} className="flex justify-center py-6">
            {isLoadingMore && (
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            )}
          </div>
        )}

        {/* Traditional Pagination */}
        {!IS_INFINITE_SCROLL && (
          <ProjectsPagination
            currentPage={currentPage}
            totalPages={Math.ceil(totalProjects / pageSize)}
            onPageChange={handlePageChange}
          />
        )}
      </CardContent>
    </Card>
  )
}
