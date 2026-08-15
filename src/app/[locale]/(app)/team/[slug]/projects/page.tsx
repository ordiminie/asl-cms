import {Metadata} from 'next'
import {Suspense} from 'react'

import {ProjectsManagementSkeleton} from '@/components/features/projects/projects-skeleton'

import ProjectsContent from './projects-content'

// Route authentifiée, pas encore migrée. Le layout fait un `await` sur la session à son
// niveau supérieur, ce qui bloque tout le segment. Le pattern officiel existe :
// https://nextjs.org/docs/app/guides/authentication-with-cache-components
// (session en 'use cache: private', promesse passée au provider, use() derrière Suspense).
// Voir D17 dans docs/plans/cache-components-migration.md.
export const instant = false

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
