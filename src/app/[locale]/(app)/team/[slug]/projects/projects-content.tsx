import {forbidden, notFound} from 'next/navigation'

import {getOrganizationBySlugDal} from '@/app/dal/organization-dal'
import {
  getProjectPermissionsByOrganizationDal,
  getProjectsByOrganizationWithPaginationDal,
} from '@/app/dal/project-dal'
import ProjectsManagement from '@/components/features/projects/projects-management'
import {canReadProjectsByOrganization} from '@/services/authorization/project-authorization'

type SearchParamsType = Promise<{
  page?: string
  limit?: string
  search?: string
}>

interface ProjectsContentProps {
  params: Promise<{
    slug: string
  }>
  searchParams: SearchParamsType
}

export default async function ProjectsContent({
  params,
  searchParams,
}: ProjectsContentProps) {
  const {slug} = await params
  const searchStore = await searchParams

  // Récupérer l'organisation par slug
  const organization = await getOrganizationBySlugDal(slug)
  if (!organization) {
    notFound()
  }

  // Vérifier les permissions pour lire les projets de cette organisation
  const canReadProjects = await canReadProjectsByOrganization(organization.id)
  if (!canReadProjects) {
    forbidden()
  }

  const page = searchStore.page ? Number.parseInt(searchStore.page) : 1
  const limit = searchStore.limit ? Number.parseInt(searchStore.limit) : 20
  const search = searchStore.search || ''
  const offset = (page - 1) * limit

  const [projects, permissions] = await Promise.all([
    getProjectsByOrganizationWithPaginationDal(
      organization.id,
      {limit, offset},
      search
    ),
    getProjectPermissionsByOrganizationDal(organization.id),
  ])

  return (
    <ProjectsManagement
      organizationId={organization.id}
      organizationSlug={organization.slug}
      initialProjects={projects.data}
      currentPage={page}
      pageSize={limit}
      totalProjects={projects.pagination.total}
      permissions={permissions}
      searchQuery={search}
    />
  )
}
