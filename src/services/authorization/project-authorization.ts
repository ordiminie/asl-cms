import {
  getProjectByIdDao,
  getTaskByIdDao,
} from '@/db/repositories/project-repository'
import {getReferenceIdByBillingMode} from '@/lib/helper/subscription-helper'
import {
  getAuthUser,
  getAuthUserId,
} from '@/services/authentication/auth-service'
import {OrganizationContext} from '@/services/types/domain/auth-types'

import {LimitTypeConst} from '../types/domain/subscription-types'
import {userCanOnResource} from './authorization-service'
import {ActionsConst, SubjectsConst} from './casl-abilities'
import {checkSubscriptionLimit} from './subscription-authorization'

/**
 * Système d'autorisation pour les projets et tâches avec contexte organisationnel
 *
 * Permissions par rôle organisationnel :
 * - OWNER/ADMIN : Peut créer/lire/modifier/supprimer tous les projets et tâches de l'organisation
 * - MEMBER : Peut lire les projets, créer/modifier ses propres tâches
 *
 * Permissions système :
 * - Utilisateurs avec rôle ADMIN/SUPER_ADMIN : Peuvent gérer tous les projets/tâches
 * - Créateur du projet/tâche : Peut toujours modifier/supprimer ses propres créations
 */

// ===== AUTORISATION PROJETS =====

/**
 * Vérifie si l'utilisateur connecté peut créer un projet dans une organisation
 */
export const canCreateProject = async (
  organizationId: string,
  requestedAmount: number = 1
): Promise<boolean> => {
  const authUser = await getAuthUser()

  const orgContext: OrganizationContext = {
    organizationId,
  }
  // 1️⃣ Vérification permissions CASL
  const hasPermission = userCanOnResource(
    authUser,
    ActionsConst.CREATE,
    SubjectsConst.PROJECT,
    {
      organizationId,
    },
    orgContext
  )
  if (!hasPermission) return false

  // 2️⃣ Vérification des limites d'abonnement
  const userId = await getAuthUserId()
  const referenceId = getReferenceIdByBillingMode(userId, organizationId)
  if (!referenceId) return false

  const limitCheck = await checkProjectCreationLimit(
    referenceId,
    requestedAmount
  )
  return limitCheck.allowed
}

/**
 * Vérifie les limites de création de projets
 * @param referenceId - ID de référence (organizationId en mode ORGANIZATION, userId en mode USER)
 * @param requestedAmount - Nombre de projets à créer (défaut: 1)
 * @returns Résultat de la vérification des limites
 */
export const checkProjectCreationLimit = async (
  referenceId: string,
  requestedAmount: number = 1
) => {
  const limitCheck = await checkSubscriptionLimit(
    LimitTypeConst.PROJECTS,
    referenceId,
    requestedAmount
  )
  return limitCheck
}

/**
 * Vérifie si l'utilisateur connecté peut lire un projet
 */
export const canReadProject = async (resourceId: string): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Récupérer le projet pour vérifier l'organisation
  const project = await getProjectByIdDao(resourceId)
  if (!project) return false

  const orgContext: OrganizationContext = {
    organizationId: project.organizationId,
  }

  return userCanOnResource(
    authUser,
    ActionsConst.READ,
    SubjectsConst.PROJECT,
    {
      id: project.id,
      organizationId: project.organizationId,
      createdBy: project.createdBy,
    },
    orgContext
  )
}

/**
 * Vérifie si l'utilisateur connecté peut mettre à jour un projet
 */
export const canUpdateProject = async (
  resourceId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Récupérer le projet pour vérifier l'organisation et la propriété
  const project = await getProjectByIdDao(resourceId)
  if (!project) return false

  const orgContext: OrganizationContext = {
    organizationId: project.organizationId,
  }

  return userCanOnResource(
    authUser,
    ActionsConst.UPDATE,
    SubjectsConst.PROJECT,
    {
      id: project.id,
      organizationId: project.organizationId,
      createdBy: project.createdBy,
    },
    orgContext
  )
}

/**
 * Vérifie si l'utilisateur connecté peut supprimer un projet
 */
export const canDeleteProject = async (
  resourceId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Récupérer le projet pour vérifier l'organisation et la propriété
  const project = await getProjectByIdDao(resourceId)
  if (!project) return false

  const orgContext: OrganizationContext = {
    organizationId: project.organizationId,
  }

  return userCanOnResource(
    authUser,
    ActionsConst.DELETE,
    SubjectsConst.PROJECT,
    {
      id: project.id,
      organizationId: project.organizationId,
      createdBy: project.createdBy,
    },
    orgContext
  )
}

// ===== AUTORISATION TÂCHES =====

/**
 * Vérifie si l'utilisateur connecté peut créer une tâche dans un projet
 */
export const canCreateTask = async (projectId: string): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Récupérer le projet pour vérifier l'organisation
  const project = await getProjectByIdDao(projectId)
  if (!project) return false

  const orgContext: OrganizationContext = {
    organizationId: project.organizationId,
  }

  return userCanOnResource(
    authUser,
    ActionsConst.CREATE,
    SubjectsConst.TASK,
    {
      organizationId: project.organizationId,
      projectId: project.id,
    },
    orgContext
  )
}

/**
 * Vérifie si l'utilisateur connecté peut lire une tâche
 */
export const canReadTask = async (resourceId: string): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Récupérer la tâche pour vérifier l'organisation
  const task = await getTaskByIdDao(resourceId)
  if (!task) return false

  const orgContext: OrganizationContext = {
    organizationId: task.organizationId,
  }

  return userCanOnResource(
    authUser,
    ActionsConst.READ,
    SubjectsConst.TASK,
    {
      id: task.id,
      organizationId: task.organizationId,
      projectId: task.projectId,
      createdBy: task.createdBy,
    },
    orgContext
  )
}

/**
 * Vérifie si l'utilisateur connecté peut mettre à jour une tâche
 */
export const canUpdateTask = async (resourceId: string): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Récupérer la tâche pour vérifier l'organisation et la propriété
  const task = await getTaskByIdDao(resourceId)
  if (!task) return false

  const orgContext: OrganizationContext = {
    organizationId: task.organizationId,
  }

  return userCanOnResource(
    authUser,
    ActionsConst.UPDATE,
    SubjectsConst.TASK,
    {
      id: task.id,
      organizationId: task.organizationId,
      projectId: task.projectId,
      createdBy: task.createdBy,
    },
    orgContext
  )
}

/**
 * Vérifie si l'utilisateur connecté peut supprimer une tâche
 */
export const canDeleteTask = async (resourceId: string): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Récupérer la tâche pour vérifier l'organisation et la propriété
  const task = await getTaskByIdDao(resourceId)
  if (!task) return false

  const orgContext: OrganizationContext = {
    organizationId: task.organizationId,
  }

  return userCanOnResource(
    authUser,
    ActionsConst.DELETE,
    SubjectsConst.TASK,
    {
      id: task.id,
      organizationId: task.organizationId,
      projectId: task.projectId,
      createdBy: task.createdBy,
    },
    orgContext
  )
}

// ===== AUTORISATION LECTURE MULTIPLE =====

/**
 * Vérifie si l'utilisateur connecté peut lire les projets d'une organisation
 */
export const canReadProjectsByOrganization = async (
  organizationId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()

  const orgContext: OrganizationContext = {
    organizationId,
  }

  return userCanOnResource(
    authUser,
    ActionsConst.READ,
    SubjectsConst.PROJECT,
    {
      organizationId,
    },
    orgContext
  )
}

/**
 * Vérifie si l'utilisateur connecté peut lire les tâches d'un projet
 */
export const canReadTasksByProject = async (
  projectId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Récupérer le projet pour vérifier l'organisation
  const project = await getProjectByIdDao(projectId)
  if (!project) return false

  const orgContext: OrganizationContext = {
    organizationId: project.organizationId,
  }

  return userCanOnResource(
    authUser,
    ActionsConst.READ,
    SubjectsConst.TASK,
    {
      organizationId: project.organizationId,
      projectId: project.id,
    },
    orgContext
  )
}
