import {notFound} from 'next/navigation'
import {Suspense} from 'react'

import {getOrganizationPermissions} from '@/app/dal/organization-dal'
import {withAuthAdmin} from '@/components/features/auth/with-auth'
import {EditOrganizationForm} from '@/components/features/organization/edit-organization-form'
import OrganizationMembersTable from '@/components/features/organization/organization-members-table'
import {getOrganizationByIdService} from '@/services/facades/organization-service-facade'

async function EditOrganizationPage({params}: {params: Promise<{id: string}>}) {
  const {id} = await params
  const organization = await getOrganizationByIdService(id)
  const {canReadMembers, canManageMembers, canEdit} =
    await getOrganizationPermissions(id)

  if (!organization) {
    notFound()
  }

  return (
    <div className="container mx-auto px-2 py-8 md:px-4">
      <div className="mx-auto">
        <h1 className="mb-8 text-2xl font-bold">
          Modifier l&apos;organisation
        </h1>
        <EditOrganizationForm organization={organization} canEdit={canEdit} />
      </div>
      <div className="mx-auto mt-12">
        <h2 className="mb-4 text-xl font-semibold">
          Membres de l&apos;organisation
        </h2>
        {canReadMembers ? (
          <Suspense fallback={<div>Chargement des membres...</div>}>
            <OrganizationMembersTable
              organizationId={organization.id}
              canManageMembers={canManageMembers}
              adminView={true}
            />
          </Suspense>
        ) : (
          <p className="text-muted-foreground text-sm">
            Vous n&apos;avez pas les droits nécessaires pour voir les membres de
            cette organisation.
          </p>
        )}
      </div>
    </div>
  )
}

export default withAuthAdmin(EditOrganizationPage)
