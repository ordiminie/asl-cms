import {Metadata} from 'next'
import {forbidden, notFound} from 'next/navigation'

import {getOrganizationBySlugDal} from '@/app/dal/organization-dal'
import {CreateProjectForm} from '@/components/features/projects/create-project-form'
import {LimitReached} from '@/components/features/subscription/limit-reached'
import {getReferenceIdByBillingMode} from '@/lib/helper/subscription-helper'
import {getAuthUserId} from '@/services/authentication/auth-service'
import {
  canCreateProject,
  checkProjectCreationLimit,
} from '@/services/authorization/project-authorization'

// Route authentifiée, pas encore migrée. Le layout fait un `await` sur la session à son
// niveau supérieur, ce qui bloque tout le segment. Le pattern officiel existe :
// https://nextjs.org/docs/app/guides/authentication-with-cache-components
// (session en 'use cache: private', promesse passée au provider, use() derrière Suspense).
// Voir D17 dans docs/plans/cache-components-migration.md.
export const instant = false

export const metadata: Metadata = {
  title: 'Nouveau projet',
  description: 'Créer un nouveau projet',
}

interface NewProjectPageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function NewProjectPage({params}: NewProjectPageProps) {
  const {slug} = await params

  // Récupérer l'organisation par slug
  const organization = await getOrganizationBySlugDal(slug)
  if (!organization) {
    notFound()
  }

  // Vérifier les limites d'abonnement
  const userId = await getAuthUserId()
  const referenceId = getReferenceIdByBillingMode(userId, organization.id)
  if (!referenceId) {
    forbidden()
  }

  const limits = await checkProjectCreationLimit(referenceId)
  if (!limits.allowed) {
    return <LimitReached limits={limits} />
  }

  // Vérifier les permissions pour créer un projet dans cette organisation
  const canCreate = await canCreateProject(organization.id)
  if (!canCreate) {
    forbidden()
  }

  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <h1 className="mb-8 text-2xl font-bold">Créer un nouveau projet</h1>
        <CreateProjectForm
          organization={organization}
          organizationSlug={slug}
        />
      </div>
    </div>
  )
}
