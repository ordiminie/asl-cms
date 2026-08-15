import {Metadata} from 'next'
import {Suspense} from 'react'

import {ProjectsManagementSkeleton} from '@/components/features/projects/projects-skeleton'

import ProjectsContent from './projects-content'

export const metadata: Metadata = {
  title: 'Projets',
  description: 'Gestion des projets',
}

type SearchParamsType = Promise<{
  page?: string
  limit?: string
  search?: string
}>

interface ProjectsPageProps {
  params: Promise<{
    slug: string
  }>
  searchParams: SearchParamsType
}

export default async function ProjectsPage({
  params,
  searchParams,
}: ProjectsPageProps) {
  return (
    <div className="bg-background">
      <Suspense fallback={<ProjectsManagementSkeleton />}>
        <ProjectsContent params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
