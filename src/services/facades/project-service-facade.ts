import projectServiceInterceptor from './interceptors/project-service-logger-interceptor'

// ===== CRUD PROJETS =====
export const createProjectService =
  projectServiceInterceptor.createProjectService
export const getProjectByIdService =
  projectServiceInterceptor.getProjectByIdService
export const updateProjectService =
  projectServiceInterceptor.updateProjectService
export const deleteProjectService =
  projectServiceInterceptor.deleteProjectService

// ===== CRUD TÂCHES =====
export const createTaskService = projectServiceInterceptor.createTaskService
export const getTaskByIdService = projectServiceInterceptor.getTaskByIdService
export const updateTaskService = projectServiceInterceptor.updateTaskService
export const deleteTaskService = projectServiceInterceptor.deleteTaskService

// ===== SERVICES DE LISTE =====
export const getProjectsWithPaginationService =
  projectServiceInterceptor.getProjectsWithPaginationService
export const getProjectsByOrganizationService =
  projectServiceInterceptor.getProjectsByOrganizationService
export const getProjectsByUserService =
  projectServiceInterceptor.getProjectsByUserService

export const getTasksWithPaginationService =
  projectServiceInterceptor.getTasksWithPaginationService
export const getTasksByProjectService =
  projectServiceInterceptor.getTasksByProjectService
export const getTasksByOrganizationService =
  projectServiceInterceptor.getTasksByOrganizationService
export const getTasksByUserService =
  projectServiceInterceptor.getTasksByUserService
export const getTasksByStatusService =
  projectServiceInterceptor.getTasksByStatusService

// ===== SERVICES POUR LE DRAG AND DROP =====
export const getTasksByProjectGroupedByStatusService =
  projectServiceInterceptor.getTasksByProjectGroupedByStatusService
export const updateTaskOrderService =
  projectServiceInterceptor.updateTaskOrderService
export const updateTasksOrderService =
  projectServiceInterceptor.updateTasksOrderService
