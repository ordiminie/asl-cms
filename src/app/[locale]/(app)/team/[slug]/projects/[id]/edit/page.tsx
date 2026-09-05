import {notFound} from 'next/navigation'
import {getTranslations} from 'next-intl/server'

import {getProjectPermissions} from '@/app/dal/project-dal'
import {EditProjectForm} from '@/components/features/projects/edit-project-form'
import {getProjectByIdService} from '@/services/facades/project-service-facade'

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{id: string}>
}) {
  const t = await getTranslations('Projects')
  const {id} = await params
  const project = await getProjectByIdService(id)
  const {canEdit} = await getProjectPermissions(id)

  if (!project) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-8 text-2xl font-bold">{t('form.editTitle')}</h1>
        <EditProjectForm project={project} canEdit={canEdit} />
      </div>
    </div>
  )
}
