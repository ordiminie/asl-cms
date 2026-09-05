import {forbidden, notFound} from 'next/navigation'

import {getOrganizationBySlugDal} from '@/app/dal/organization-dal'
import {canReadOrganizationMember} from '@/services/authorization/organization-authorization'

import ProjectsReactQueryPage from './projects-react-query'

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
