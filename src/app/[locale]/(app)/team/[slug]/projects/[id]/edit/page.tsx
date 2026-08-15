import {notFound} from 'next/navigation'

import {getProjectPermissions} from '@/app/dal/project-dal'
import {EditProjectForm} from '@/components/features/projects/edit-project-form'
import {getProjectByIdService} from '@/services/facades/project-service-facade'

// Route authentifiée, pas encore migrée. Le layout fait un `await` sur la session à son
// niveau supérieur, ce qui bloque tout le segment. Le pattern officiel existe :
// https://nextjs.org/docs/app/guides/authentication-with-cache-components
// (session en 'use cache: private', promesse passée au provider, use() derrière Suspense).
// Voir D17 dans docs/plans/cache-components-migration.md.
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
