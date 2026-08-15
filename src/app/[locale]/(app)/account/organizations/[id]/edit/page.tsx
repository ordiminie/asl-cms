import {notFound} from 'next/navigation'
import {Suspense} from 'react'

import {getOrganizationPermissions} from '@/app/dal/organization-dal'
import {EditOrganizationForm} from '@/components/features/organization/edit-organization-form'
import OrganizationMembersTable from '@/components/features/organization/organization-members-table'
import {getOrganizationByIdService} from '@/services/facades/organization-service-facade'

// Route authentifiée : le layout lit la session via getAuthUser() -> headers() et la
// passe à AuthProvider, qui enveloppe tout l'arbre. Aucun enfant à isoler dans un
// <Suspense> — c'est le cas que la doc Next appelle « no child to wrap ». Lever cet
// opt-out demande de revoir comment AuthProvider obtient l'utilisateur (D16).
export const instant = false

export default async function EditOrganizationPage({
  params,
}: {
  params: Promise<{id: string}>
}) {
  const {id} = await params
  const organization = await getOrganizationByIdService(id)
  const {canReadMembers, canManageMembers, canEdit} =
    await getOrganizationPermissions(id)

  if (!organization) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Modifier l&apos;organisation
        </h2>
      </div>

      <div className="space-y-8">
        <div>
          <EditOrganizationForm organization={organization} canEdit={canEdit} />
        </div>

        <div>
          <h3 className="mb-4 text-lg font-medium">
            Membres de l&apos;organisation
          </h3>
          {canReadMembers ? (
            <Suspense fallback={<div>Chargement des membres...</div>}>
              <OrganizationMembersTable
                organizationId={organization.id}
                canManageMembers={canManageMembers}
              />
            </Suspense>
          ) : (
            <p className="text-muted-foreground text-sm">
              Vous n&apos;avez pas les droits nécessaires pour voir les membres
              de cette organisation.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
