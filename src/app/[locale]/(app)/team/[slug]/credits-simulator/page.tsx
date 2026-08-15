import {notFound} from 'next/navigation'

import {getBalanceService} from '@/services/facades/credit-service-facade'
import {getOrganizationBySlugService} from '@/services/facades/organization-service-facade'

import {SimulatorContent} from './simulator-content'

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
