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
