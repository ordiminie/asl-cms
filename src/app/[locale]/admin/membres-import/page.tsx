import {Metadata} from 'next'

import {getAllOrganizationsWithPaginationDal} from '@/app/dal/organization-dal'
import {MEMBER_IMPORT_ORGANIZATION_PARAM} from '@/components/features/admin/member-import/member-import-paths'
import {MemberImportScreen} from '@/components/features/admin/member-import/member-import-screen'
import type {MemberImportOrganizationChoice} from '@/components/features/admin/member-import/member-import-state'
import {withAuthAdmin} from '@/components/features/auth/with-auth'

import {importMembersAction} from './actions'

export const metadata: Metadata = {
  title: 'Importer des membres',
  description: "Import initial des membres d'une association",
}

/** Les associations proposees au choix : la plateforme en compte peu. */
const ORGANIZATION_CHOICES_LIMIT = 500

type SearchParams = Promise<Record<string, string | string[] | undefined>>

/**
 * Import initial des membres (s13), SuperAdmin seul. Arrivee depuis la fiche
 * d'une association : elle est deja choisie (1b). Le tenant n'est jamais
 * deduit du domaine ici : il est passe explicitement au service.
 */
async function MemberImportPage({searchParams}: {searchParams: SearchParams}) {
  const requested = (await searchParams)[MEMBER_IMPORT_ORGANIZATION_PARAM]
  const {data} = await getAllOrganizationsWithPaginationDal({
    limit: ORGANIZATION_CHOICES_LIMIT,
    offset: 0,
  })
  const organizations: MemberImportOrganizationChoice[] = data
    .map(({id, name}) => ({id, name}))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  const initialOrganizationId = organizations.some(({id}) => id === requested)
    ? (requested as string)
    : undefined

  return (
    <MemberImportScreen
      organizations={organizations}
      initialOrganizationId={initialOrganizationId}
      importAction={importMembersAction}
    />
  )
}

export default withAuthAdmin(MemberImportPage)
