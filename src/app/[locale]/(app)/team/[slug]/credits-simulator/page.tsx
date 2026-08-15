import {notFound} from 'next/navigation'

import {getBalanceService} from '@/services/facades/credit-service-facade'
import {getOrganizationBySlugService} from '@/services/facades/organization-service-facade'

import {SimulatorContent} from './simulator-content'

// Route authentifiée, pas encore migrée. Le layout fait un `await` sur la session à son
// niveau supérieur, ce qui bloque tout le segment. Le pattern officiel existe :
// https://nextjs.org/docs/app/guides/authentication-with-cache-components
// (session en 'use cache: private', promesse passée au provider, use() derrière Suspense).
// Voir D17 dans docs/plans/cache-components-migration.md.
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
