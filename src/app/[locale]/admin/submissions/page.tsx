import {Metadata} from 'next'
import {Suspense} from 'react'

import {SubmissionsManagementSkeleton} from '@/components/features/admin/submissions/submissions-management-skeleton'
import {withAuthAdmin} from '@/components/features/auth/with-auth'

import SubmissionsContent from './submissions-content'

// Route authentifiée : le layout lit la session via getAuthUser() -> headers() et la
// passe à AuthProvider, qui enveloppe tout l'arbre. Aucun enfant à isoler dans un
// <Suspense> — c'est le cas que la doc Next appelle « no child to wrap ». Lever cet
// opt-out demande de revoir comment AuthProvider obtient l'utilisateur (D16).
export const instant = false

export const metadata: Metadata = {
  title: 'Soumissions',
  description: 'Gestion des soumissions utilisateurs',
}

type SearchParamsType = Promise<{
  page?: string
  limit?: string
  search?: string
  type?: 'contact' | 'feedback' | 'support'
  read?: string
}>

async function SubmissionsPage({
  searchParams,
}: {
  searchParams: SearchParamsType
}) {
  const params = await searchParams
  const suspenseKey = `page=${params.page || '1'}-limit=${params.limit || '20'}-search=${params.search || ''}-type=${params.type || ''}-read=${params.read || ''}`

  return (
    <div className="bg-background">
      <Suspense key={suspenseKey} fallback={<SubmissionsManagementSkeleton />}>
        <SubmissionsContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

export default withAuthAdmin(SubmissionsPage)
