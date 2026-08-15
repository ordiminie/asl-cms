import {Metadata} from 'next'
import {Suspense} from 'react'

import {ProjectsManagementSkeleton} from '@/components/features/projects/projects-skeleton'

import ProjectsContent from './projects-content'

// Route authentifiée : le layout lit la session via getAuthUser() -> headers() et la
// passe à AuthProvider, qui enveloppe tout l'arbre. Aucun enfant à isoler dans un
// <Suspense> — c'est le cas que la doc Next appelle « no child to wrap ». Lever cet
// opt-out demande de revoir comment AuthProvider obtient l'utilisateur (D16).
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
