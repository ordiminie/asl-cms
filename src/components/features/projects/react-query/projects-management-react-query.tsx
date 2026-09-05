'use client'

import {formatDistanceToNow} from 'date-fns'
import {Folder, Plus} from 'lucide-react'
import {useLocale, useTranslations} from 'next-intl'
import {use, useState} from 'react'

import {OrganizationDTO} from '@/app/dal/organization-dal'
import {
  useDeleteProject,
  useProjects,
  useUpdateProject,
} from '@/components/hooks/client/project-client'
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
import {getDateFnsLocale} from '@/lib/helper/date-helper'
import {ProjectDTO} from '@/services/types/domain/project-types'

import {ProjectsPagination} from '../projects-pagination'
import {ProjectsToolbar} from '../projects-toolbar'
import {CreateProjectDialog} from './create-project-dialog-rq'
import {DeleteProjectDialog} from './delete-project-dialog-rq'
import {EditProjectDialog} from './edit-project-dialog-rq'

interface Props {
  organization: OrganizationDTO
  searchParams: Promise<{
    page?: string
    limit?: string
    search?: string
  }>
}

export function ProjectsManagementReactQuery({
  organization,
  searchParams,
}: Props) {
  const t = useTranslations('Projects')
  const tCommon = useTranslations('Common')
  const locale = useLocale()
  const searchStore = use(searchParams)

  // États locaux pour la pagination et recherche
  const [page, setPage] = useState(Number(searchStore.page) || 1)
  const [limit, setLimit] = useState(Number(searchStore.limit) || 20)
  const [search, setSearch] = useState(searchStore.search || '')

  // Utilisation de l'organizationId réel
  const organizationId = organization.id

  // Hooks React Query
  const {
    data: projectsResponse,
    isLoading,
    isError,
    error,
  } = useProjects({
    page,
    limit,
    search,
    organizationId,
  })

  const updateProjectMutation = useUpdateProject()
  const deleteProjectMutation = useDeleteProject()

  // Handlers
  const handleSearch = (newSearch: string) => {
    setSearch(newSearch)
    setPage(1) // Reset à la première page
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  const handlePerPageChange = (newLimit: string) => {
    setLimit(Number(newLimit))
    setPage(1) // Reset à la première page
  }

  const handleUpdateProject = async (
    id: string,
    data: {name: string; description?: string}
  ) => {
    updateProjectMutation.mutate({id, data})
  }

  const handleDeleteProject = async (id: string) => {
    deleteProjectMutation.mutate(id)
  }

  // Mock permissions - à adapter selon votre logique
  const permissions = {
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canManage: true,
  }

  if (isLoading) {
    return (
      <Card className="border-0 sm:border">
        <CardContent className="p-6">
          <div className="text-center">{t('management.loading')}</div>
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card className="border-0 sm:border">
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            Erreur lors du chargement des projets:{' '}
            {error && typeof error === 'object' && 'message' in error
              ? (error.message as string)
              : t('management.unknownError')}
          </div>
        </CardContent>
      </Card>
    )
  }

  const projects = projectsResponse?.data || []
  const pagination = projectsResponse?.pagination || {
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  }

  return (
    <Card className="border-0 sm:border">
      <CardHeader className="px-4 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t('management.titleReactQuery')}</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              Organisation : {organization.name}
            </p>
          </div>
          {permissions.canCreate && (
            <CreateProjectDialog
              organizationId={organizationId}
              trigger={
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nouveau projet
                </Button>
              }
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        <ProjectsToolbar
          onSearch={handleSearch}
          initialSearch={search}
          totalProjects={pagination.total}
          onPerPageChange={handlePerPageChange}
          perPage={limit.toString()}
        />

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('management.project')}</TableHead>
              <TableHead className="hidden xl:table-cell">
                {tCommon('fields.description')}
              </TableHead>
              <TableHead className="hidden lg:table-cell">
                {t('management.createdAt')}
              </TableHead>
              <TableHead>{tCommon('fields.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project: ProjectDTO) => (
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
                      {project.description || t('management.noDescription')}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden xl:table-cell">
                  <div className="truncate">
                    {project.description || t('management.noDescription')}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground hidden text-sm lg:table-cell">
                  {project.createdAt &&
                    formatDistanceToNow(new Date(project.createdAt), {
                      addSuffix: true,
                      locale: getDateFnsLocale(locale),
                    })}
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    {permissions.canEdit && (
                      <EditProjectDialog
                        project={project}
                        onSave={handleUpdateProject}
                        isLoading={updateProjectMutation.isPending}
                      />
                    )}
                    {permissions.canDelete && (
                      <div className="hidden sm:block">
                        <DeleteProjectDialog
                          projectId={project.id}
                          projectName={project.name}
                          onDelete={handleDeleteProject}
                          isLoading={deleteProjectMutation.isPending}
                        />
                      </div>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <ProjectsPagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={handlePageChange}
        />
      </CardContent>
    </Card>
  )
}
