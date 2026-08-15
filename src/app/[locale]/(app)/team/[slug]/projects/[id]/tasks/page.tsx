import {notFound} from 'next/navigation'
import {Suspense} from 'react'

import {getTasksByProjectGroupedByStatusDal} from '@/app/dal/task-dal'
import {getUsersByOrganizationDal} from '@/app/dal/user-dal'
import {CreateTaskModal} from '@/components/features/tasks/create-task-modal'
import {TaskBoardComponent} from '@/components/features/tasks/task-board'
import {Button} from '@/components/ui/button'
import {getProjectByIdService} from '@/services/facades/project-service-facade'

// Route authentifiée, pas encore migrée. Le layout fait un `await` sur la session à son
// niveau supérieur, ce qui bloque tout le segment. Le pattern officiel existe :
// https://nextjs.org/docs/app/guides/authentication-with-cache-components
// (session en 'use cache: private', promesse passée au provider, use() derrière Suspense).
// Voir D17 dans docs/plans/cache-components-migration.md.
export const instant = false

async function TaskBoard({projectId}: {projectId: string}) {
  const [tasks, project] = await Promise.all([
    getTasksByProjectGroupedByStatusDal(projectId),
    getProjectByIdService(projectId),
  ])

  if (!project) {
    return null
  }

  const users = await getUsersByOrganizationDal(project.organizationId)
  const usersMap = users.reduce(
    (acc, user) => {
      acc[user.id] = {
        id: user.id,
        name: user.name,
        email: user.email,
      }
      return acc
    },
    {} as Record<string, {id: string; name: string | null; email: string}>
  )

  return <TaskBoardComponent tasks={tasks} usersMap={usersMap} />
}

export default async function TasksPage({
  params,
}: {
  params: Promise<{id: string; slug: string}>
}) {
  const {id, slug} = await params
  const project = await getProjectByIdService(id)

  if (!project) {
    notFound()
  }

  const users = await getUsersByOrganizationDal(project.organizationId)

  return (
    <div className="space-y-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-muted-foreground">Gestion des tâches</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href={`/team/${slug}/projects/${id}/edit`}>Modifier le projet</a>
          </Button>
          <CreateTaskModal
            projectId={id}
            organizationId={project.organizationId}
            users={users}
          >
            <Button>Nouvelle tâche</Button>
          </CreateTaskModal>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center">
            <div className="text-center">
              <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"></div>
              <p className="text-muted-foreground">Chargement des tâches...</p>
            </div>
          </div>
        }
      >
        <TaskBoard projectId={id} />
      </Suspense>
    </div>
  )
}
