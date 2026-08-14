import {notFound} from 'next/navigation'

import {getProjectPermissions} from '@/app/dal/project-dal'
import {EditProjectForm} from '@/components/features/projects/edit-project-form'
import {getProjectByIdService} from '@/services/facades/project-service-facade'

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
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
