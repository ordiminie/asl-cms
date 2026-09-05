import {
  createProjectDao,
  createTaskDao,
  deleteProjectByIdDao,
  deleteTaskByIdDao,
  getProjectByIdDao,
  getProjectsByOrganizationIdDao,
  getProjectsByUserIdDao,
  getProjectsWithPaginationDao,
  getTaskByIdDao,
  getTasksByOrganizationIdDao,
  getTasksByProjectIdDao,
  getTasksByProjectIdGroupedByStatusDao,
  getTasksByStatusDao,
  getTasksByUserIdDao,
  getTasksWithPaginationDao,
  updateProjectByIdDao,
  updateTaskByIdDao,
  updateTaskOrderDao,
  updateTasksOrderDao,
} from '@/db/repositories/project-repository'

import {getAuthUser} from './authentication/auth-service'
import {
  canCreateProject,
  canCreateTask,
  canDeleteProject,
  canDeleteTask,
  canReadProject,
  canReadProjectsByOrganization,
  canReadTask,
  canReadTasksByProject,
  canUpdateProject,
  canUpdateTask,
} from './authorization/project-authorization'
import {AuthorizationError} from './errors/authorization-error'
import {ValidationError} from './errors/validation-error'
import {createTypedNotificationService} from './facades/notification-service-facade'
import {Pagination} from './types/common-type'
import {NotificationTypeConst} from './types/domain/notification-types'
import {
  CreateProject,
  CreateTask,
  ProjectFilters,
  TaskFilters,
  TaskStatus,
  UpdateProject,
  UpdateTask,
} from './types/domain/project-types'
import {
  createProjectServiceSchema,
  createTaskServiceSchema,
  organizationUuidSchema,
  projectFiltersSchema,
  projectUuidSchema,
  taskFiltersSchema,
  taskStatusSchema,
  taskUuidSchema,
  updateProjectServiceSchema,
  updateTaskServiceSchema,
  userUuidSchema,
} from './validation/project-validation'

// ===== SERVICES PROJET =====

/**
 * Créer un nouveau projet
 */
export const createProjectService = async (projectData: CreateProject) => {
  // Validation des données
  const parsed = createProjectServiceSchema.safeParse(projectData)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const validatedData = parsed.data

  // Vérification des autorisations
  const granted = await canCreateProject(validatedData.organizationId)
  if (!granted) {
    throw new AuthorizationError()
  }

  const project = await createProjectDao(validatedData)

  const user = await getAuthUser()
  await createTypedNotificationService({
    userId: user?.id || '',
    type: NotificationTypeConst.project_created,
    metadata: {
      projectId: project.id,
      projectName: project.name,
      organizationId: project.organizationId,
    },
  })
  // Création du projet
  return project
}

/**
 * Récupérer un projet par ID
 */
export const getProjectByIdService = async (projectId: string) => {
  // Validation de l'ID
  const parsed = projectUuidSchema.safeParse(projectId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const validatedId = parsed.data

  // Vérification des autorisations
  const granted = await canReadProject(validatedId)
  if (!granted) {
    throw new AuthorizationError()
  }

  // Récupération du projet
  return await getProjectByIdDao(validatedId)
}

/**
 * Mettre à jour un projet
 */
export const updateProjectService = async (projectData: UpdateProject) => {
  // Validation des données
  const parsed = updateProjectServiceSchema.safeParse(projectData)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const validatedData = parsed.data

  // Vérification des autorisations
  const granted = await canUpdateProject(validatedData.id)
  if (!granted) {
    throw new AuthorizationError()
  }

  // Récupérer le projet existant
  const existingProject = await getProjectByIdDao(validatedData.id)
  if (!existingProject) {
    throw new ValidationError('Projet non trouvé')
  }

  // Préparer les données de mise à jour avec les valeurs existantes
  const updateData = {
    ...existingProject,
    ...validatedData,
  }

  // Mise à jour du projet
  await updateProjectByIdDao(updateData)
  return await getProjectByIdDao(validatedData.id)
}

/**
 * Supprimer un projet
 */
export const deleteProjectService = async (projectId: string) => {
  // Validation de l'ID
  const parsed = projectUuidSchema.safeParse(projectId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const validatedId = parsed.data

  // Vérification des autorisations
  const granted = await canDeleteProject(validatedId)
  if (!granted) {
    throw new AuthorizationError()
  }

  // Suppression du projet
  await deleteProjectByIdDao(validatedId)
}

// ===== SERVICES TÂCHE =====

/**
 * Créer une nouvelle tâche
 */
export const createTaskService = async (taskData: CreateTask) => {
  // Validation des données
  const parsed = createTaskServiceSchema.safeParse(taskData)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const validatedData = parsed.data

  // Vérification des autorisations
  const granted = await canCreateTask(validatedData.projectId)
  if (!granted) {
    throw new AuthorizationError()
  }

  // Création de la tâche
  return await createTaskDao(validatedData)
}

/**
 * Récupérer une tâche par ID
 */
export const getTaskByIdService = async (taskId: string) => {
  // Validation de l'ID
  const parsed = taskUuidSchema.safeParse(taskId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const validatedId = parsed.data

  // Vérification des autorisations
  const granted = await canReadTask(validatedId)
  if (!granted) {
    throw new AuthorizationError()
  }

  // Récupération de la tâche
  return await getTaskByIdDao(validatedId)
}

/**
 * Mettre à jour une tâche
 */
export const updateTaskService = async (taskData: UpdateTask) => {
  // Validation des données
  const parsed = updateTaskServiceSchema.safeParse(taskData)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const validatedData = parsed.data

  // Vérification des autorisations
  const granted = await canUpdateTask(validatedData.id)
  if (!granted) {
    throw new AuthorizationError()
  }

  // Récupérer la tâche existante
  const existingTask = await getTaskByIdDao(validatedData.id)
  if (!existingTask) {
    throw new ValidationError('Tâche non trouvée')
  }

  // Préparer les données de mise à jour avec les valeurs existantes
  const updateData = {
    ...existingTask,
    ...validatedData,
  }

  // Mise à jour de la tâche
  await updateTaskByIdDao(updateData)
  return await getTaskByIdDao(validatedData.id)
}

/**
 * Supprimer une tâche
 */
export const deleteTaskService = async (taskId: string) => {
  // Validation de l'ID
  const parsed = taskUuidSchema.safeParse(taskId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const validatedId = parsed.data

  // Vérification des autorisations
  const granted = await canDeleteTask(validatedId)
  if (!granted) {
    throw new AuthorizationError()
  }

  // Suppression de la tâche
  await deleteTaskByIdDao(validatedId)
}

// ===== SERVICES DE LISTE =====

/**
 * Récupérer les projets avec pagination
 */
export const getProjectsWithPaginationService = async (
  pagination: Pagination,
  filters?: ProjectFilters
) => {
  // Validation des filtres si fournis
  if (filters) {
    const parsed = projectFiltersSchema.safeParse(filters)
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message)
    }
  }

  // Si filtre par organisation, vérifier les autorisations
  if (filters?.organizationId) {
    const granted = await canReadProjectsByOrganization(filters.organizationId)
    if (!granted) {
      throw new AuthorizationError()
    }
  }

  // Récupération des projets
  return await getProjectsWithPaginationDao(pagination, filters)
}

/**
 * Récupérer les projets d'une organisation
 */
export const getProjectsByOrganizationService = async (
  organizationId: string
) => {
  // Validation de l'ID
  const parsed = organizationUuidSchema.safeParse(organizationId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const validatedId = parsed.data

  // Vérification des autorisations
  const granted = await canReadProjectsByOrganization(validatedId)
  if (!granted) {
    throw new AuthorizationError()
  }

  // Récupération des projets
  return await getProjectsByOrganizationIdDao(validatedId)
}

/**
 * Récupérer les projets d'un utilisateur
 */
export const getProjectsByUserService = async (userId: string) => {
  // Validation de l'ID
  const parsed = userUuidSchema.safeParse(userId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const validatedId = parsed.data

  // Récupération des projets (autorisation gérée par les filtres DAO)
  return await getProjectsByUserIdDao(validatedId)
}

/**
 * Récupérer les tâches avec pagination
 */
export const getTasksWithPaginationService = async (
  pagination: Pagination,
  filters?: TaskFilters
) => {
  // Validation des filtres si fournis
  if (filters) {
    const parsed = taskFiltersSchema.safeParse(filters)
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message)
    }
  }

  // Si filtre par projet, vérifier les autorisations
  if (filters?.projectId) {
    const granted = await canReadTasksByProject(filters.projectId)
    if (!granted) {
      throw new AuthorizationError()
    }
  }

  // Récupération des tâches
  return await getTasksWithPaginationDao(pagination, filters)
}

/**
 * Récupérer les tâches d'un projet
 */
export const getTasksByProjectService = async (projectId: string) => {
  // Validation de l'ID
  const parsed = projectUuidSchema.safeParse(projectId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const validatedId = parsed.data

  // Vérification des autorisations
  const granted = await canReadTasksByProject(validatedId)
  if (!granted) {
    throw new AuthorizationError()
  }

  // Récupération des tâches
  return await getTasksByProjectIdDao(validatedId)
}

/**
 * Récupérer les tâches d'une organisation
 */
export const getTasksByOrganizationService = async (organizationId: string) => {
  // Validation de l'ID
  const parsed = organizationUuidSchema.safeParse(organizationId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const validatedId = parsed.data

  // Vérification des autorisations
  const granted = await canReadProjectsByOrganization(validatedId)
  if (!granted) {
    throw new AuthorizationError()
  }

  // Récupération des tâches
  return await getTasksByOrganizationIdDao(validatedId)
}

/**
 * Récupérer les tâches d'un utilisateur
 */
export const getTasksByUserService = async (userId: string) => {
  // Validation de l'ID
  const parsed = userUuidSchema.safeParse(userId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const validatedId = parsed.data

  // Récupération des tâches (autorisation gérée par les filtres DAO)
  return await getTasksByUserIdDao(validatedId)
}

/**
 * Récupérer les tâches par statut
 */
export const getTasksByStatusService = async (
  status: TaskStatus,
  organizationId?: string
) => {
  // Validation du statut
  const parsedStatus = taskStatusSchema.safeParse(status)
  if (!parsedStatus.success) {
    throw new ValidationError(parsedStatus.error.message)
  }
  const validatedStatus = parsedStatus.data

  // Validation de l'organisation si fournie
  if (organizationId) {
    const parsedOrgId = organizationUuidSchema.safeParse(organizationId)
    if (!parsedOrgId.success) {
      throw new ValidationError(parsedOrgId.error.message)
    }

    // Vérification des autorisations pour l'organisation
    const granted = await canReadProjectsByOrganization(organizationId)
    if (!granted) {
      throw new AuthorizationError()
    }
  }

  // Récupération des tâches
  return await getTasksByStatusDao(validatedStatus, organizationId)
}

// ===== SERVICES POUR LE DRAG AND DROP =====

/**
 * Récupérer les tâches d'un projet groupées par statut
 */
export const getTasksByProjectGroupedByStatusService = async (
  projectId: string
) => {
  // Validation de l'ID
  const parsed = projectUuidSchema.safeParse(projectId)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message)
  }
  const validatedId = parsed.data

  // Vérification des autorisations
  const granted = await canReadTasksByProject(validatedId)
  if (!granted) {
    throw new AuthorizationError()
  }

  // Récupération des tâches groupées
  return await getTasksByProjectIdGroupedByStatusDao(validatedId)
}

/**
 * Mettre à jour l'ordre d'une tâche
 */
export const updateTaskOrderService = async (
  taskId: string,
  newOrder: number,
  newStatus?: TaskStatus
) => {
  // Validation de l'ID de la tâche
  const parsedTaskId = taskUuidSchema.safeParse(taskId)
  if (!parsedTaskId.success) {
    throw new ValidationError(parsedTaskId.error.message)
  }
  const validatedTaskId = parsedTaskId.data

  // Validation du statut si fourni
  if (newStatus) {
    const parsedStatus = taskStatusSchema.safeParse(newStatus)
    if (!parsedStatus.success) {
      throw new ValidationError(parsedStatus.error.message)
    }
  }

  // Vérification des autorisations
  const granted = await canUpdateTask(validatedTaskId)
  if (!granted) {
    throw new AuthorizationError()
  }

  // Mise à jour de l'ordre
  await updateTaskOrderDao(validatedTaskId, newOrder, newStatus)
}

/**
 * Mettre à jour l'ordre de plusieurs tâches
 */
export const updateTasksOrderService = async (
  tasksUpdates: Array<{id: string; order: number; status?: TaskStatus}>
) => {
  // Validation des données
  for (const taskUpdate of tasksUpdates) {
    const parsedTaskId = taskUuidSchema.safeParse(taskUpdate.id)
    if (!parsedTaskId.success) {
      throw new ValidationError(
        `ID de tâche invalide: ${parsedTaskId.error.message}`
      )
    }

    if (taskUpdate.status) {
      const parsedStatus = taskStatusSchema.safeParse(taskUpdate.status)
      if (!parsedStatus.success) {
        throw new ValidationError(
          `Statut invalide: ${parsedStatus.error.message}`
        )
      }
    }

    // Vérification des autorisations pour chaque tâche
    const granted = await canUpdateTask(taskUpdate.id)
    if (!granted) {
      throw new AuthorizationError(
        `Autorisation refusée pour la tâche ${taskUpdate.id}`
      )
    }
  }

  // Mise à jour de l'ordre des tâches
  await updateTasksOrderDao(tasksUpdates)
}
