import {and, eq, ilike, sql} from 'drizzle-orm'

import db from '@/db/models/db'
import {
  AddProjectModel,
  AddTaskModel,
  ProjectModel,
  projects,
  TaskModel,
  tasks,
  TaskStatusEnumModel,
  UpdateProjectModel,
  UpdateTaskModel,
} from '@/db/models/project-model'
import {PaginatedResponse, Pagination} from '@/services/types/common-type'
import {
  ProjectFilters,
  TaskFilters,
} from '@/services/types/domain/project-types'

// ===== CRUD PROJECTS =====

export const createProjectDao = async (
  project: AddProjectModel
): Promise<ProjectModel> => {
  const row = await db.insert(projects).values(project).returning()
  return row[0]
}

export const getProjectByIdDao = async (
  projectId: string
): Promise<ProjectModel | undefined> => {
  const row = await db.query.projects.findFirst({
    where: (project, {eq}) => eq(project.id, projectId),
  })
  return row
}

export const updateProjectByIdDao = async (
  project: UpdateProjectModel
): Promise<void> => {
  if (!project.id) {
    throw new Error('Project ID is required')
  }
  await db
    .update(projects)
    .set({...project, updatedAt: new Date()})
    .where(eq(projects.id, project.id))
}

export const deleteProjectByIdDao = async (
  projectId: string
): Promise<void> => {
  await db.delete(projects).where(eq(projects.id, projectId))
}

// ===== CRUD TASKS =====

export const createTaskDao = async (task: AddTaskModel): Promise<TaskModel> => {
  const row = await db.insert(tasks).values(task).returning()
  return row[0]
}

export const getTaskByIdDao = async (
  taskId: string
): Promise<TaskModel | undefined> => {
  const row = await db.query.tasks.findFirst({
    where: (task, {eq}) => eq(task.id, taskId),
  })
  return row
}

export const updateTaskByIdDao = async (
  task: UpdateTaskModel
): Promise<void> => {
  if (!task.id) {
    throw new Error('Task ID is required')
  }
  await db
    .update(tasks)
    .set({...task, updatedAt: new Date()})
    .where(eq(tasks.id, task.id))
}

export const deleteTaskByIdDao = async (taskId: string): Promise<void> => {
  await db.delete(tasks).where(eq(tasks.id, taskId))
}

// ===== REQUÊTES PROJECTS AVEC PAGINATION =====

export const getProjectsWithPaginationDao = async (
  pagination: Pagination,
  filters?: ProjectFilters
): Promise<PaginatedResponse<ProjectModel>> => {
  const whereConditions = []

  if (filters?.organizationId) {
    whereConditions.push(eq(projects.organizationId, filters.organizationId))
  }
  if (filters?.createdBy) {
    whereConditions.push(eq(projects.createdBy, filters.createdBy))
  }
  if (filters?.name) {
    whereConditions.push(ilike(projects.name, `%${filters.name}%`))
  }

  const whereClause =
    whereConditions.length > 0 ? and(...whereConditions) : undefined

  const [rows, [{count}]] = await Promise.all([
    db
      .select()
      .from(projects)
      .where(whereClause)
      .limit(pagination.limit)
      .offset(pagination.offset)
      .orderBy(projects.createdAt),
    db
      .select({count: sql<number>`count(*)`})
      .from(projects)
      .where(whereClause),
  ])

  const page = Math.floor(pagination.offset / pagination.limit) + 1
  const totalPages = Math.ceil(count / pagination.limit)

  return {
    data: rows.length === 0 ? [] : rows,
    pagination: {
      total: count,
      page: page,
      limit: pagination.limit,
      totalPages: totalPages,
    },
  }
}

export const getProjectsByOrganizationIdDao = async (
  organizationId: string
): Promise<ProjectModel[]> => {
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.organizationId, organizationId))
    .orderBy(projects.name)

  return rows
}

export const getProjectsByUserIdDao = async (
  userId: string
): Promise<ProjectModel[]> => {
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.createdBy, userId))
    .orderBy(projects.createdAt)

  return rows
}

// ===== REQUÊTES TASKS AVEC PAGINATION =====

export const getTasksWithPaginationDao = async (
  pagination: Pagination,
  filters?: TaskFilters
): Promise<PaginatedResponse<TaskModel>> => {
  const whereConditions = []

  if (filters?.organizationId) {
    whereConditions.push(eq(tasks.organizationId, filters.organizationId))
  }
  if (filters?.projectId) {
    whereConditions.push(eq(tasks.projectId, filters.projectId))
  }
  if (filters?.createdBy) {
    whereConditions.push(eq(tasks.createdBy, filters.createdBy))
  }
  if (filters?.status) {
    whereConditions.push(eq(tasks.status, filters.status))
  }

  const whereClause =
    whereConditions.length > 0 ? and(...whereConditions) : undefined

  const [rows, [{count}]] = await Promise.all([
    db
      .select()
      .from(tasks)
      .where(whereClause)
      .limit(pagination.limit)
      .offset(pagination.offset)
      .orderBy(tasks.createdAt),
    db
      .select({count: sql<number>`count(*)`})
      .from(tasks)
      .where(whereClause),
  ])

  const page = Math.floor(pagination.offset / pagination.limit) + 1
  const totalPages = Math.ceil(count / pagination.limit)

  return {
    data: rows.length === 0 ? [] : rows,
    pagination: {
      total: count,
      page: page,
      limit: pagination.limit,
      totalPages: totalPages,
    },
  }
}

export const getTasksByProjectIdDao = async (
  projectId: string
): Promise<TaskModel[]> => {
  const rows = await db
    .select()
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
    .orderBy(tasks.order, tasks.createdAt)

  return rows
}

export const getTasksByOrganizationIdDao = async (
  organizationId: string
): Promise<TaskModel[]> => {
  const rows = await db
    .select()
    .from(tasks)
    .where(eq(tasks.organizationId, organizationId))
    .orderBy(tasks.createdAt)

  return rows
}

export const getTasksByUserIdDao = async (
  userId: string
): Promise<TaskModel[]> => {
  const rows = await db
    .select()
    .from(tasks)
    .where(eq(tasks.createdBy, userId))
    .orderBy(tasks.createdAt)

  return rows
}

export const getTasksByStatusDao = async (
  status: TaskStatusEnumModel,
  organizationId?: string
): Promise<TaskModel[]> => {
  const whereConditions = [eq(tasks.status, status)]

  if (organizationId) {
    whereConditions.push(eq(tasks.organizationId, organizationId))
  }

  const rows = await db
    .select()
    .from(tasks)
    .where(and(...whereConditions))
    .orderBy(tasks.order, tasks.createdAt)

  return rows
}

// ===== FONCTIONS POUR LE DRAG AND DROP =====

export const updateTaskOrderDao = async (
  taskId: string,
  newOrder: number,
  newStatus?: TaskStatusEnumModel
): Promise<void> => {
  const updateData: Partial<UpdateTaskModel> = {
    order: newOrder,
    updatedAt: new Date(),
  }

  if (newStatus) {
    updateData.status = newStatus
  }

  await db.update(tasks).set(updateData).where(eq(tasks.id, taskId))
}

export const updateTasksOrderDao = async (
  tasksUpdates: Array<{id: string; order: number; status?: TaskStatusEnumModel}>
): Promise<void> => {
  await db.transaction(async (tx) => {
    for (const taskUpdate of tasksUpdates) {
      const updateData: Partial<UpdateTaskModel> = {
        order: taskUpdate.order,
        updatedAt: new Date(),
      }

      if (taskUpdate.status) {
        updateData.status = taskUpdate.status
      }

      await tx.update(tasks).set(updateData).where(eq(tasks.id, taskUpdate.id))
    }
  })
}

export const getTasksByProjectIdGroupedByStatusDao = async (
  projectId: string
): Promise<Record<TaskStatusEnumModel, TaskModel[]>> => {
  const allTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
    .orderBy(tasks.order, tasks.createdAt)

  const groupedTasks: Record<TaskStatusEnumModel, TaskModel[]> = {
    todo: [],
    in_progress: [],
    done: [],
  }

  allTasks.forEach((task) => {
    groupedTasks[task.status].push(task)
  })

  return groupedTasks
}
