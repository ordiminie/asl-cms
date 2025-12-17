import {forbidden, notFound} from 'next/navigation'

import {
  getOrganizationByIdDal,
  getOrganizationMembersDal,
  getOrganizationUsageDal,
  OrganizationMemberDTO,
} from '@/app/dal/organization-dal'
import {TeamPageContent} from '@/components/features/team/team-page-content'
import {canReadOrganizationMember} from '@/services/authorization/organization-authorization'

interface TeamPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function OrganizationDetailPage({params}: TeamPageProps) {
  const {id} = await params

  // Récupérer l'organisation par slug
  const organization = await getOrganizationByIdDal(id)

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

  // Récupérer les membres et l'usage de l'organisation en parallèle
  const [members, usage]: [
    OrganizationMemberDTO[],
    Awaited<ReturnType<typeof getOrganizationUsageDal>>,
  ] = await Promise.all([
    getOrganizationMembersDal(organization.id),
    getOrganizationUsageDal(organization.id),
  ])

  return (
    <TeamPageContent
      organization={organization}
      members={members}
      usage={usage}
    />
  )
}
