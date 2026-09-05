import {z} from 'zod'

import {
  CreateProject,
  CreateTask,
  UpdateProject,
  UpdateTask,
} from '@/services/types/domain/project-types'

// ===== SCHÉMAS DE BASE =====

export const projectUuidSchema = z.string().uuid({
  message: "L'ID du projet n'est pas valide.",
})

export const taskUuidSchema = z.string().uuid({
  message: "L'ID de la tâche n'est pas valide.",
})

export const organizationUuidSchema = z.string().uuid({
  message: "L'ID de l'organisation n'est pas valide.",
})

export const userUuidSchema = z.string().uuid({
  message: "L'ID de l'utilisateur n'est pas valide.",
})

// ===== SCHÉMAS ENUM =====

export const taskStatusSchema = z.enum(['todo', 'in_progress', 'done'], {
  message: 'Le statut de la tâche doit être "todo", "in_progress" ou "done".',
})

// ===== SCHÉMAS COMMUNS =====

const baseProjectSchema = z.object({
  name: z
    .string()
    .min(1, {
      message: 'Le nom du projet ne peut pas être vide.',
    })
    .min(3, {
      message: 'Le nom du projet doit contenir au moins 3 caractères.',
    })
    .max(100, {
      message: 'Le nom du projet ne doit pas contenir plus de 100 caractères.',
    }),
  description: z
    .string()
    .max(500, {
      message: 'La description ne doit pas contenir plus de 500 caractères.',
    })
    .optional()
    .nullable(),
})

const baseTaskSchema = z.object({
  title: z
    .string()
    .min(1, {
      message: 'Le titre de la tâche ne peut pas être vide.',
    })
    .min(3, {
      message: 'Le titre de la tâche doit contenir au moins 3 caractères.',
    })
    .max(200, {
      message:
        'Le titre de la tâche ne doit pas contenir plus de 200 caractères.',
    }),
  description: z
    .string()
    .max(1000, {
      message: 'La description ne doit pas contenir plus de 1000 caractères.',
    })
    .optional()
    .nullable(),
  status: taskStatusSchema.optional(),
  order: z
    .number()
    .int({
      message: "L'ordre doit être un nombre entier.",
    })
    .min(0, {
      message: "L'ordre doit être supérieur ou égal à 0.",
    })
    .optional(),
  dueDate: z
    .date({
      message: "La date d'échéance doit être une date valide.",
    })
    .optional()
    .nullable(),
  assignedTo: z
    .string()
    .uuid({
      message: "L'ID de l'utilisateur assigné n'est pas valide.",
    })
    .optional()
    .nullable(),
})

// ===== SCHÉMAS PROJET =====

export const createProjectServiceSchema = baseProjectSchema.extend({
  organizationId: organizationUuidSchema,
  createdBy: userUuidSchema.optional().nullable(),
}) satisfies z.Schema<CreateProject>

export const updateProjectServiceSchema = z.object({
  id: projectUuidSchema,
  name: z
    .string()
    .min(3, {
      message: 'Le nom du projet doit contenir au moins 3 caractères.',
    })
    .max(100, {
      message: 'Le nom du projet ne doit pas contenir plus de 100 caractères.',
    })
    .optional(),
  description: z
    .string()
    .max(500, {
      message: 'La description ne doit pas contenir plus de 500 caractères.',
    })
    .optional()
    .nullable(),
  organizationId: organizationUuidSchema.optional(),
  createdBy: userUuidSchema.optional().nullable(),
}) satisfies z.Schema<UpdateProject>

// ===== SCHÉMAS TÂCHE =====

export const createTaskServiceSchema = baseTaskSchema.extend({
  projectId: projectUuidSchema,
  organizationId: organizationUuidSchema,
  createdBy: userUuidSchema.optional().nullable(),
}) satisfies z.Schema<CreateTask>

export const updateTaskServiceSchema = z.object({
  id: taskUuidSchema,
  title: z
    .string()
    .min(3, {
      message: 'Le titre de la tâche doit contenir au moins 3 caractères.',
    })
    .max(200, {
      message:
        'Le titre de la tâche ne doit pas contenir plus de 200 caractères.',
    })
    .optional(),
  description: z
    .string()
    .max(1000, {
      message: 'La description ne doit pas contenir plus de 1000 caractères.',
    })
    .optional()
    .nullable(),
  status: taskStatusSchema.optional(),
  order: z
    .number()
    .int({
      message: "L'ordre doit être un nombre entier.",
    })
    .min(0, {
      message: "L'ordre doit être supérieur ou égal à 0.",
    })
    .optional(),
  dueDate: z
    .date({
      message: "La date d'échéance doit être une date valide.",
    })
    .optional()
    .nullable(),
  projectId: projectUuidSchema.optional(),
  organizationId: organizationUuidSchema.optional(),
  createdBy: userUuidSchema.optional().nullable(),
  assignedTo: userUuidSchema.optional().nullable(),
}) satisfies z.Schema<UpdateTask>

// ===== SCHÉMAS DE FILTRES =====

export const projectFiltersSchema = z.object({
  organizationId: organizationUuidSchema.optional(),
  createdBy: userUuidSchema.optional(),
  name: z.string().optional(),
})

export const taskFiltersSchema = z.object({
  organizationId: organizationUuidSchema.optional(),
  projectId: projectUuidSchema.optional(),
  createdBy: userUuidSchema.optional(),
  status: taskStatusSchema.optional(),
  title: z.string().optional(),
})

// ===== SCHÉMAS DE PAGINATION =====

export const paginationSchema = z.object({
  page: z
    .number()
    .int({
      message: 'Le numéro de page doit être un nombre entier.',
    })
    .min(1, {
      message: 'Le numéro de page doit être supérieur à 0.',
    })
    .optional()
    .default(1),
  limit: z
    .number()
    .int({
      message: 'La limite doit être un nombre entier.',
    })
    .min(1, {
      message: 'La limite doit être supérieure à 0.',
    })
    .max(100, {
      message: 'La limite ne peut pas dépasser 100.',
    })
    .optional()
    .default(10),
})

// ===== SCHÉMAS DRAG AND DROP =====

export const updateTaskOrderSchema = z.object({
  taskId: taskUuidSchema,
  newOrder: z
    .number()
    .int({
      message: "L'ordre doit être un nombre entier.",
    })
    .min(0, {
      message: "L'ordre doit être supérieur ou égal à 0.",
    }),
  newStatus: taskStatusSchema.optional(),
})

export const updateTasksOrderSchema = z.object({
  tasksUpdates: z.array(
    z.object({
      id: taskUuidSchema,
      order: z
        .number()
        .int({
          message: "L'ordre doit être un nombre entier.",
        })
        .min(0, {
          message: "L'ordre doit être supérieur ou égal à 0.",
        }),
      status: taskStatusSchema.optional(),
    })
  ),
})

// ===== TYPES EXTRAITS =====

export type ProjectFiltersInput = z.infer<typeof projectFiltersSchema>
export type TaskFiltersInput = z.infer<typeof taskFiltersSchema>
export type PaginationInput = z.infer<typeof paginationSchema>
export type UpdateTaskOrderInput = z.infer<typeof updateTaskOrderSchema>
export type UpdateTasksOrderInput = z.infer<typeof updateTasksOrderSchema>
