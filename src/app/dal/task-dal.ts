import 'server-only'

import {cache} from 'react'

import {
  getTasksByProjectGroupedByStatusService,
  getTasksByProjectService,
} from '@/services/facades/project-service-facade'
import {TaskBoard, TaskDTO} from '@/services/types/domain/project-types'

export const getTasksByProjectDal = cache(
  async (projectId: string): Promise<TaskDTO[]> => {
    return await getTasksByProjectService(projectId)
  }
)

export const getTasksByProjectGroupedByStatusDal = cache(
  async (projectId: string): Promise<TaskBoard> => {
    return await getTasksByProjectGroupedByStatusService(projectId)
  }
)
