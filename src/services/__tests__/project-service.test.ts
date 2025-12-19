import {faker} from '@faker-js/faker'
import {beforeEach, describe, expect, it, vi} from 'vitest'

// Mock des DAOs avant l'import
vi.mock('@/db/repositories/project-repository')
vi.mock('@/db/repositories/user-repository')
vi.mock('@/db/repositories/notification-repository')

import {NotificationModel} from '@/db/models/notification-model'
import {createNotificationDao} from '@/db/repositories/notification-repository'
import {
  createProjectDao,
  createTaskDao,
  deleteProjectByIdDao,
  deleteTaskByIdDao,
  getProjectByIdDao,
  getProjectsByOrganizationIdDao,
  getTaskByIdDao,
  getTasksByProjectIdDao,
  updateProjectByIdDao,
  updateTaskByIdDao,
} from '@/db/repositories/project-repository'
import {getUserByIdDao} from '@/db/repositories/user-repository'

import {
  getActiveSubscriptions,
  getAuthUserId,
  getSessionReferenceId,
} from '../authentication/auth-service'
import {AuthorizationError} from '../errors/authorization-error'
import {
  createProjectService,
  createTaskService,
  deleteProjectService,
  getProjectByIdService,
  getTaskByIdService,
  updateProjectService,
} from '../project-service'
import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import {NotificationTypeConst} from '../types/domain/notification-types'
import {
  CreateProject,
  CreateTask,
  Project,
  Task,
  UpdateProject,
} from '../types/domain/project-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest, userTestAdmin} from './service-test-data'

describe('[ADMIN] CRUD : Project Service', () => {
  const organizationId = faker.string.uuid()
  const projectId = faker.string.uuid()
  const taskId = faker.string.uuid()

  const projectData: Project = {
    id: projectId,
    name: 'Test Project',
    description: 'Description du projet',
    organizationId,
    createdBy: userTestAdmin.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const taskData: Task = {
    id: taskId,
    title: 'Test Task',
    description: 'Description de la tâche',
    status: 'todo',
    dueDate: new Date(),
    projectId,
    organizationId,
    createdBy: userTestAdmin.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    order: 0,
    assignedTo: null,
  }

  const notificationData: NotificationModel = {
    id: faker.string.uuid(),
    userId: userTestAdmin.id,
    type: NotificationTypeConst.project_created,
    metadata: {
      projectId,
    },
    title: '',
    message: '',
    read: false,
    createdAt: new Date(),
  }

  beforeEach(() => {
    setupAuthUserMocked(userTestAdmin)
    vi.clearAllMocks()

    vi.mocked(createProjectDao).mockResolvedValue(projectData)
    vi.mocked(getProjectByIdDao).mockResolvedValue(projectData)
    vi.mocked(updateProjectByIdDao).mockResolvedValue()
    vi.mocked(deleteProjectByIdDao).mockResolvedValue()
    vi.mocked(getProjectsByOrganizationIdDao).mockResolvedValue([projectData])

    vi.mocked(createTaskDao).mockResolvedValue(taskData)
    vi.mocked(getTaskByIdDao).mockResolvedValue(taskData)
    vi.mocked(updateTaskByIdDao).mockResolvedValue()
    vi.mocked(deleteTaskByIdDao).mockResolvedValue()
    vi.mocked(getTasksByProjectIdDao).mockResolvedValue([taskData])

    vi.mocked(createNotificationDao).mockResolvedValue(notificationData)

    // Mock pour les notifications
    vi.mocked(getUserByIdDao).mockResolvedValue(userTestAdmin)
  })

  it('should create a new project', async () => {
    const createData: CreateProject = {
      name: 'Test Project',
      description: 'Description du projet',
      organizationId,
      createdBy: userTestAdmin.id,
    }
    vi.mocked(getSessionReferenceId).mockResolvedValue(organizationId)
    vi.mocked(getAuthUserId).mockResolvedValue(userTestAdmin.id)
    vi.mocked(getActiveSubscriptions).mockResolvedValue([
      {
        id: faker.string.uuid(),
        plan: 'Test Subscription',
        stripeSubscriptionId: faker.string.uuid(),
        stripeCustomerId: faker.string.uuid(),
        limits: {
          projects: 10,
        },
        seats: 10,
        priceId: undefined,
        referenceId: organizationId,
        status: 'active',
      },
    ])

    const result = await createProjectService(createData)

    expect(result).toEqual(projectData)
    expect(createProjectDao).toHaveBeenCalledWith(createData)
  })

  it('should get a project by id', async () => {
    const result = await getProjectByIdService(projectId)

    expect(result).toEqual(projectData)
    expect(getProjectByIdDao).toHaveBeenCalledWith(projectId)
  })

  it('should update a project', async () => {
    const updateData: UpdateProject = {
      id: projectId,
      name: 'Updated Project',
    }

    const result = await updateProjectService(updateData)

    expect(result).toEqual(projectData)
    expect(updateProjectByIdDao).toHaveBeenCalled()
  })

  it('should delete a project', async () => {
    await deleteProjectService(projectId)

    expect(deleteProjectByIdDao).toHaveBeenCalledWith(projectId)
  })

  it('should create a new task', async () => {
    const createData: CreateTask = {
      title: 'Test Task',
      description: 'Description de la tâche',
      status: 'todo',
      dueDate: new Date(),
      projectId,
      organizationId,
      createdBy: userTestAdmin.id,
    }

    const result = await createTaskService(createData)

    expect(result).toEqual(taskData)
    expect(createTaskDao).toHaveBeenCalledWith(createData)
  })

  it('should get a task by id', async () => {
    const result = await getTaskByIdService(taskId)

    expect(result).toEqual(taskData)
    expect(getTaskByIdDao).toHaveBeenCalledWith(taskId)
  })
})

describe('[PUBLIC] Project Service', () => {
  const projectId = faker.string.uuid()
  const organizationId = faker.string.uuid()

  beforeEach(() => {
    setupAuthUserMocked(undefined)
    vi.clearAllMocks()
  })

  it('should NOT access projects as public user', async () => {
    await expect(getProjectByIdService(projectId)).rejects.toThrow(
      AuthorizationError
    )
    expect(getProjectByIdDao).toHaveBeenCalledTimes(1) //Seulement 1 (dans canRead)
  })

  it('should NOT create projects as public user', async () => {
    const createData: CreateProject = {
      name: 'Test Project',
      organizationId,
    }

    await expect(createProjectService(createData)).rejects.toThrow(
      AuthorizationError
    )
    expect(createProjectDao).not.toHaveBeenCalled()
  })
})

// ===== TESTS RÔLES ORGANISATIONNELS =====

describe('[ORGANIZATION OWNER] CRUD : Project Service', () => {
  const organizationId = faker.string.uuid()
  const projectId = faker.string.uuid()
  const taskId = faker.string.uuid()

  const projectData: Project = {
    id: projectId,
    name: 'Test Project',
    description: 'Description du projet',
    organizationId,
    createdBy: userTest.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const taskData: Task = {
    id: taskId,
    title: 'Test Task',
    description: 'Description de la tâche',
    status: 'todo',
    dueDate: new Date(),
    projectId,
    organizationId,
    createdBy: userTest.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    order: 0,
    assignedTo: null,
  }

  beforeEach(() => {
    const userOwner = {
      ...userTest,
      organizations: [
        {
          id: faker.string.uuid(),
          createdAt: new Date(),
          userId: userTest.id,
          organizationId,
          role: UserOrganizationRoleConst.OWNER,
          joinedAt: new Date(),
        },
      ],
    }

    setupAuthUserMocked(userOwner)
    vi.clearAllMocks()

    vi.mocked(createProjectDao).mockResolvedValue(projectData)
    vi.mocked(getProjectByIdDao).mockResolvedValue(projectData)
    vi.mocked(updateProjectByIdDao).mockResolvedValue()
    vi.mocked(deleteProjectByIdDao).mockResolvedValue()
    vi.mocked(getProjectsByOrganizationIdDao).mockResolvedValue([projectData])

    vi.mocked(createTaskDao).mockResolvedValue(taskData)
    vi.mocked(getTaskByIdDao).mockResolvedValue(taskData)
    vi.mocked(updateTaskByIdDao).mockResolvedValue()
    vi.mocked(deleteTaskByIdDao).mockResolvedValue()
    vi.mocked(getTasksByProjectIdDao).mockResolvedValue([taskData])

    // Mock pour les notifications
    vi.mocked(getUserByIdDao).mockResolvedValue(userTest)
  })

  it('should create a project as owner', async () => {
    const createData: CreateProject = {
      name: 'Test Project',
      description: 'Description du projet',
      organizationId,
      createdBy: userTest.id,
    }
    vi.mocked(getSessionReferenceId).mockResolvedValue(organizationId)
    vi.mocked(getAuthUserId).mockResolvedValue(userTest.id)
    vi.mocked(getActiveSubscriptions).mockResolvedValue([
      {
        id: faker.string.uuid(),
        plan: 'Test Subscription',
        stripeSubscriptionId: faker.string.uuid(),
        stripeCustomerId: faker.string.uuid(),
        limits: {
          projects: 10,
        },
        seats: 10,
        priceId: undefined,
        referenceId: organizationId,
        status: 'active',
      },
    ])
    const result = await createProjectService(createData)

    expect(result).toEqual(projectData)
    expect(createProjectDao).toHaveBeenCalledWith(createData)
  })

  it('should read project as owner', async () => {
    const result = await getProjectByIdService(projectId)

    expect(result).toEqual(projectData)
    expect(getProjectByIdDao).toHaveBeenCalledWith(projectId)
  })

  it('should update project as owner', async () => {
    const updateData: UpdateProject = {
      id: projectId,
      name: 'Updated Project',
    }

    const result = await updateProjectService(updateData)

    expect(result).toEqual(projectData)
    expect(updateProjectByIdDao).toHaveBeenCalled()
  })

  it('should delete project as owner', async () => {
    await deleteProjectService(projectId)

    expect(deleteProjectByIdDao).toHaveBeenCalledWith(projectId)
  })

  it('should create a task as owner', async () => {
    const createData: CreateTask = {
      title: 'Test Task',
      description: 'Description de la tâche',
      status: 'todo',
      dueDate: new Date(),
      projectId,
      organizationId,
      createdBy: userTest.id,
    }

    const result = await createTaskService(createData)

    expect(result).toEqual(taskData)
    expect(createTaskDao).toHaveBeenCalledWith(createData)
  })

  it('should read task as owner', async () => {
    const result = await getTaskByIdService(taskId)

    expect(result).toEqual(taskData)
    expect(getTaskByIdDao).toHaveBeenCalledWith(taskId)
  })
})

describe('[ORGANIZATION ADMIN] CRUD : Project Service', () => {
  const organizationId = faker.string.uuid()
  const projectId = faker.string.uuid()
  const taskId = faker.string.uuid()

  const projectData: Project = {
    id: projectId,
    name: 'Test Project',
    description: 'Description du projet',
    organizationId,
    createdBy: userTest.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const taskData: Task = {
    id: taskId,
    title: 'Test Task',
    description: 'Description de la tâche',
    status: 'todo',
    dueDate: new Date(),
    projectId,
    organizationId,
    createdBy: userTest.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    order: 0,
    assignedTo: null,
  }

  beforeEach(() => {
    const userOrgAdmin = {
      ...userTest,
      organizations: [
        {
          id: faker.string.uuid(),
          createdAt: new Date(),
          userId: userTest.id,
          organizationId,
          role: UserOrganizationRoleConst.ADMIN,
          joinedAt: new Date(),
        },
      ],
    }
    setupAuthUserMocked(userOrgAdmin)
    vi.clearAllMocks()

    vi.mocked(createProjectDao).mockResolvedValue(projectData)
    vi.mocked(getProjectByIdDao).mockResolvedValue(projectData)
    vi.mocked(updateProjectByIdDao).mockResolvedValue()
    vi.mocked(deleteProjectByIdDao).mockResolvedValue()
    vi.mocked(getProjectsByOrganizationIdDao).mockResolvedValue([projectData])

    vi.mocked(createTaskDao).mockResolvedValue(taskData)
    vi.mocked(getTaskByIdDao).mockResolvedValue(taskData)
    vi.mocked(updateTaskByIdDao).mockResolvedValue()
    vi.mocked(deleteTaskByIdDao).mockResolvedValue()
    vi.mocked(getTasksByProjectIdDao).mockResolvedValue([taskData])

    // Mock pour les notifications
    vi.mocked(getUserByIdDao).mockResolvedValue(userTest)
  })

  it('should create a project as admin', async () => {
    const createData: CreateProject = {
      name: 'Test Project',
      description: 'Description du projet',
      organizationId,
      createdBy: userTest.id,
    }
    vi.mocked(getSessionReferenceId).mockResolvedValue(organizationId)
    vi.mocked(getAuthUserId).mockResolvedValue(userTest.id)
    vi.mocked(getActiveSubscriptions).mockResolvedValue([
      {
        id: faker.string.uuid(),
        plan: 'Test Subscription',
        stripeSubscriptionId: faker.string.uuid(),
        stripeCustomerId: faker.string.uuid(),
        limits: {
          projects: 10,
        },
        seats: 10,
        priceId: undefined,
        referenceId: organizationId,
        status: 'active',
      },
    ])
    const result = await createProjectService(createData)

    expect(result).toEqual(projectData)
    expect(createProjectDao).toHaveBeenCalledWith(createData)
  })

  it('should read project as admin', async () => {
    const result = await getProjectByIdService(projectId)

    expect(result).toEqual(projectData)
    expect(getProjectByIdDao).toHaveBeenCalledWith(projectId)
  })

  it('should update project as admin', async () => {
    const updateData: UpdateProject = {
      id: projectId,
      name: 'Updated Project',
    }

    const result = await updateProjectService(updateData)

    expect(result).toEqual(projectData)
    expect(updateProjectByIdDao).toHaveBeenCalled()
  })

  it('should delete project as admin', async () => {
    await deleteProjectService(projectId)

    expect(deleteProjectByIdDao).toHaveBeenCalledWith(projectId)
  })

  it('should create a task as admin', async () => {
    const createData: CreateTask = {
      title: 'Test Task',
      description: 'Description de la tâche',
      status: 'todo',
      dueDate: new Date(),
      projectId,
      organizationId,
      createdBy: userTest.id,
    }

    const result = await createTaskService(createData)

    expect(result).toEqual(taskData)
    expect(createTaskDao).toHaveBeenCalledWith(createData)
  })

  it('should read task as admin', async () => {
    const result = await getTaskByIdService(taskId)

    expect(result).toEqual(taskData)
    expect(getTaskByIdDao).toHaveBeenCalledWith(taskId)
  })
})

describe('[ORGANIZATION MEMBER] CRUD : Project Service', () => {
  const organizationId = faker.string.uuid()
  const projectId = faker.string.uuid()
  const taskId = faker.string.uuid()

  const projectData: Project = {
    id: projectId,
    name: 'Test Project',
    description: 'Description du projet',
    organizationId,
    createdBy: userTest.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const taskData: Task = {
    id: taskId,
    title: 'Test Task',
    description: 'Description de la tâche',
    status: 'todo',
    dueDate: new Date(),
    projectId,
    organizationId,
    createdBy: userTest.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    order: 0,
    assignedTo: null,
  }

  beforeEach(() => {
    const userMember = {
      ...userTest,
      organizations: [
        {
          id: faker.string.uuid(),
          createdAt: new Date(),
          userId: userTest.id,
          organizationId,
          role: UserOrganizationRoleConst.MEMBER,
          joinedAt: new Date(),
        },
      ],
    }
    setupAuthUserMocked(userMember)
    vi.clearAllMocks()

    vi.mocked(getProjectByIdDao).mockResolvedValue(projectData)
    vi.mocked(getTaskByIdDao).mockResolvedValue(taskData)
    vi.mocked(createTaskDao).mockResolvedValue(taskData)
    vi.mocked(updateTaskByIdDao).mockResolvedValue()
    vi.mocked(deleteTaskByIdDao).mockResolvedValue()
  })

  // PROJETS - MEMBER peut seulement lire
  it('should NOT create a project as member', async () => {
    const createData: CreateProject = {
      name: 'Test Project',
      organizationId,
    }

    await expect(createProjectService(createData)).rejects.toThrow(
      AuthorizationError
    )
    expect(createProjectDao).not.toHaveBeenCalled()
  })

  it('should read project as member', async () => {
    const result = await getProjectByIdService(projectId)

    expect(result).toEqual(projectData)
    expect(getProjectByIdDao).toHaveBeenCalledWith(projectId)
  })

  it('should NOT update project as member', async () => {
    const updateData: UpdateProject = {
      id: projectId,
      name: 'Updated Project',
    }

    await expect(updateProjectService(updateData)).rejects.toThrow(
      AuthorizationError
    )
    expect(updateProjectByIdDao).not.toHaveBeenCalled()
  })

  it('should NOT delete project as member', async () => {
    await expect(deleteProjectService(projectId)).rejects.toThrow(
      AuthorizationError
    )
    expect(deleteProjectByIdDao).not.toHaveBeenCalled()
  })

  // TÂCHES - MEMBER peut créer et gérer ses propres tâches
  it('should create a task as member', async () => {
    const createData: CreateTask = {
      title: 'Test Task',
      description: 'Description de la tâche',
      status: 'todo',
      dueDate: new Date(),
      projectId,
      organizationId,
      createdBy: userTest.id,
    }

    const result = await createTaskService(createData)

    expect(result).toEqual(taskData)
    expect(createTaskDao).toHaveBeenCalledWith(createData)
  })

  it('should read task as member', async () => {
    const result = await getTaskByIdService(taskId)

    expect(result).toEqual(taskData)
    expect(getTaskByIdDao).toHaveBeenCalledWith(taskId)
  })
})

describe('[USER NOT IN ORGANIZATION] CRUD : Project Service', () => {
  const organizationId = faker.string.uuid()
  const otherOrganizationId = faker.string.uuid()
  const projectId = faker.string.uuid()
  const taskId = faker.string.uuid()

  const projectData: Project = {
    id: projectId,
    name: 'Test Project',
    description: 'Description du projet',
    organizationId, // Projet dans une autre organisation
    createdBy: faker.string.uuid(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const taskData: Task = {
    id: taskId,
    title: 'Test Task',
    description: 'Description de la tâche',
    status: 'todo',
    dueDate: new Date(),
    projectId,
    organizationId, // Tâche dans une autre organisation
    createdBy: faker.string.uuid(),
    createdAt: new Date(),
    updatedAt: new Date(),
    order: 0,
    assignedTo: null,
  }

  beforeEach(() => {
    // Utilisateur avec accès à une autre organisation
    const userNotInOrg = {
      ...userTest,
      organizations: [
        {
          id: faker.string.uuid(),
          createdAt: new Date(),
          userId: userTest.id,
          organizationId: otherOrganizationId, // Différente de celle du projet
          role: UserOrganizationRoleConst.OWNER,
          joinedAt: new Date(),
        },
      ],
    }
    setupAuthUserMocked(userNotInOrg)
    vi.clearAllMocks()

    vi.mocked(getProjectByIdDao).mockResolvedValue(projectData)
    vi.mocked(getTaskByIdDao).mockResolvedValue(taskData)
  })

  it('should NOT create a project in organization user is not member of', async () => {
    const createData: CreateProject = {
      name: 'Test Project',
      organizationId, // Organisation dont l'utilisateur n'est pas membre
    }

    await expect(createProjectService(createData)).rejects.toThrow(
      AuthorizationError
    )
    expect(createProjectDao).not.toHaveBeenCalled()
  })

  it('should NOT read project from organization user is not member of', async () => {
    await expect(getProjectByIdService(projectId)).rejects.toThrow(
      AuthorizationError
    )
    expect(getProjectByIdDao).toHaveBeenCalledWith(projectId) // Appelé pour vérifier l'organisation
  })

  it('should NOT update project from organization user is not member of', async () => {
    const updateData: UpdateProject = {
      id: projectId,
      name: 'Updated Project',
    }

    await expect(updateProjectService(updateData)).rejects.toThrow(
      AuthorizationError
    )
    expect(updateProjectByIdDao).not.toHaveBeenCalled()
  })

  it('should NOT delete project from organization user is not member of', async () => {
    await expect(deleteProjectService(projectId)).rejects.toThrow(
      AuthorizationError
    )
    expect(deleteProjectByIdDao).not.toHaveBeenCalled()
  })

  it('should NOT create task in project from organization user is not member of', async () => {
    const createData: CreateTask = {
      title: 'Test Task',
      projectId, // Projet dans une organisation dont l'utilisateur n'est pas membre
      organizationId,
    }

    await expect(createTaskService(createData)).rejects.toThrow(
      AuthorizationError
    )
    expect(createTaskDao).not.toHaveBeenCalled()
  })

  it('should NOT read task from organization user is not member of', async () => {
    await expect(getTaskByIdService(taskId)).rejects.toThrow(AuthorizationError)
    expect(getTaskByIdDao).toHaveBeenCalledWith(taskId) // Appelé pour vérifier l'organisation
  })
})
