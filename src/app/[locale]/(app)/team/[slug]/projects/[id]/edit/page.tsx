import {notFound} from 'next/navigation'

import {getProjectPermissions} from '@/app/dal/project-dal'
import {EditProjectForm} from '@/components/features/projects/edit-project-form'
import {getProjectByIdService} from '@/services/facades/project-service-facade'

// Route authentifiée : le layout lit la session via getAuthUser() -> headers() et la
// passe à AuthProvider, qui enveloppe tout l'arbre. Aucun enfant à isoler dans un
// <Suspense> — c'est le cas que la doc Next appelle « no child to wrap ». Lever cet
// opt-out demande de revoir comment AuthProvider obtient l'utilisateur (D16).
export const instant = false

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{id: string}>
}) {
  const {id} = await params
  const project = await getProjectByIdService(id)
  const {canEdit} = await getProjectPermissions(id)

  if (!project) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-8 text-2xl font-bold">Modifier le projet</h1>
        <EditProjectForm project={project} canEdit={canEdit} />
      </div>
    </div>
  )
}
