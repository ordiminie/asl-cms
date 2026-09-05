'use client'

import {Suspense} from 'react'

import {OrganizationDTO} from '@/app/dal/organization-dal'
import {ProjectsManagementSkeleton} from '@/components/features/projects/projects-skeleton'
import {ProjectsManagementReactQuery} from '@/components/features/projects/react-query/projects-management-react-query'

interface ProjectsPageProps {
  organization: OrganizationDTO
  searchParams: Promise<{
    page?: string
    limit?: string
    search?: string
  }>
}

export default function ProjectsReactQueryPage({
  organization,
  searchParams,
}: ProjectsPageProps) {
  return (
    <div className="bg-background">
      <Suspense fallback={<ProjectsManagementSkeleton />}>
        <ProjectsManagementReactQuery
          organization={organization}
          searchParams={searchParams}
        />
      </Suspense>
    </div>
  )
}
