import {notFound} from 'next/navigation'

import {getBalanceService} from '@/services/facades/credit-service-facade'
import {getOrganizationBySlugService} from '@/services/facades/organization-service-facade'

import {SimulatorContent} from './simulator-content'

// Route authentifiée : le layout lit la session via getAuthUser() -> headers() et la
// passe à AuthProvider, qui enveloppe tout l'arbre. Aucun enfant à isoler dans un
// <Suspense> — c'est le cas que la doc Next appelle « no child to wrap ». Lever cet
// opt-out demande de revoir comment AuthProvider obtient l'utilisateur (D16).
export const instant = false

interface PageProps {
  params: Promise<{slug: string}>
}

export default async function CreditsSimulatorPage({params}: PageProps) {
  const {slug} = await params
  const organization = await getOrganizationBySlugService(slug)

  if (!organization) {
    notFound()
  }

  const balance = await getBalanceService(organization.id)

  return (
    <SimulatorContent
      organizationId={organization.id}
      initialBalance={balance}
    />
  )
}
