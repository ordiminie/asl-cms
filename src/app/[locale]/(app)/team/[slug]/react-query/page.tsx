import {forbidden, notFound} from 'next/navigation'

import {getOrganizationBySlugDal} from '@/app/dal/organization-dal'
import {canReadOrganizationMember} from '@/services/authorization/organization-authorization'

import ProjectsReactQueryPage from './projects-react-query'

// Route authentifiée : le layout lit la session via getAuthUser() -> headers() et la
// passe à AuthProvider, qui enveloppe tout l'arbre. Aucun enfant à isoler dans un
// <Suspense> — c'est le cas que la doc Next appelle « no child to wrap ». Lever cet
// opt-out demande de revoir comment AuthProvider obtient l'utilisateur (D16).
export const instant = false

interface TeamPageProps {
  params: Promise<{
    slug: string
  }>
  searchParams: Promise<{
    page?: string
    limit?: string
    search?: string
  }>
}

export default async function TeamPage({params, searchParams}: TeamPageProps) {
  const {slug} = await params

  // Récupérer l'organisation par slug
  const organization = await getOrganizationBySlugDal(slug)

  if (!organization) {
    notFound()
  }

  // Vérifier les permissions pour lire les membres
  // Si on ne peut pas lire les membres, on ne peut pas accéder à cette page
  // canreadOrganization return true car un organization est publique
  const canReadMembers = await canReadOrganizationMember(organization.id)
  if (!canReadMembers) {
    forbidden()
  }

  return (
    <ProjectsReactQueryPage
      organization={organization}
      searchParams={searchParams}
    />
  )
}
