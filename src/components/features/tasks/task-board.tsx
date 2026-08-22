'use client'

import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {arrayMove} from '@dnd-kit/sortable'
import {useTranslations} from 'next-intl'
import {useState, useTransition} from 'react'
import {toast} from 'sonner'

import {updateTasksOrderAction} from '@/app/[locale]/(app)/team/[slug]/projects/actions'
import {
  TaskBoard,
  TaskDTO,
  TaskStatus,
} from '@/services/types/domain/project-types'

import {TaskCard} from './task-card'
import {TaskColumn} from './task-column'

interface TaskBoardProps {
  tasks: TaskBoard
  usersMap?: Record<string, {id: string; name: string | null; email: string}>
}

export function TaskBoardComponent({tasks, usersMap = {}}: TaskBoardProps) {
  const t = useTranslations('Tasks')
  const [activeTask, setActiveTask] = useState<TaskDTO | null>(null)
  const [localTasks, setLocalTasks] = useState(tasks)
  const [syncedTasks, setSyncedTasks] = useState(tasks)
  const [isPending, startTransition] = useTransition()

  // Resynchroniser sur la prop quand le serveur renvoie de nouvelles tâches
  if (syncedTasks !== tasks) {
    setSyncedTasks(tasks)
    setLocalTasks(tasks)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    const {active} = event
    if (active.data.current?.type === 'task') {
      setActiveTask(active.data.current.task)
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    const {active, over} = event
    if (!over) return

    const activeType = active.data.current?.type
    const overType = over.data.current?.type

    if (activeType === 'task') {
      const activeTask = active.data.current?.task as TaskDTO
      const activeColumn = activeTask.status
      let overColumn: TaskStatus

      if (overType === 'column') {
        overColumn = over.data.current?.status
      } else if (overType === 'task') {
        overColumn = over.data.current?.task.status
      } else {
        return
      }

      if (activeColumn === overColumn) return

      const activeColumnTasks = localTasks[activeColumn]
      const overColumnTasks = localTasks[overColumn]

      const activeIndex = activeColumnTasks.findIndex(
        (task) => task.id === activeTask.id
      )

      if (activeIndex === -1) return

      setLocalTasks({
        ...localTasks,
        [activeColumn]: activeColumnTasks.filter(
          (task) => task.id !== activeTask.id
        ),
        [overColumn]: [...overColumnTasks, {...activeTask, status: overColumn}],
      })
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const {active, over} = event
    setActiveTask(null)

    if (!over || isPending) return

    const activeType = active.data.current?.type
    const overType = over.data.current?.type

    if (activeType === 'task') {
      const activeTask = active.data.current?.task as TaskDTO
      let overColumn: TaskStatus
      let overTaskId: string | null = null

      if (overType === 'column') {
        overColumn = over.data.current?.status
      } else if (overType === 'task') {
        const overTask = over.data.current?.task as TaskDTO
        overColumn = overTask.status
        overTaskId = overTask.id
      } else {
        return
      }

      const overColumnTasks = localTasks[overColumn]
      let newTasks = [...overColumnTasks]

      const activeIndex = newTasks.findIndex(
        (task) => task.id === activeTask.id
      )

      if (activeIndex !== -1) {
        if (overTaskId) {
          const overIndex = newTasks.findIndex((task) => task.id === overTaskId)
          if (overIndex !== -1) {
            newTasks = arrayMove(newTasks, activeIndex, overIndex)
          }
        }
      }

      const updatedTasks = newTasks.map((task, index) => ({
        ...task,
        order: index,
        status: overColumn,
      }))

      // Mise à jour optimiste locale
      setLocalTasks({
        ...localTasks,
        [overColumn]: updatedTasks,
      })

      // Mise à jour en arrière-plan
      startTransition(async () => {
        try {
          const tasksUpdates = updatedTasks.map((task, index) => ({
            id: task.id,
            order: index,
            status: overColumn,
          }))

          const response = await updateTasksOrderAction(tasksUpdates)
          if (!response.success) {
            toast.error(response.message)
          } else {
            toast.success(t('actions.updateOrder'))
          }
        } catch {
          toast.error(t('actions.orderUpdateError'))
        }
      })
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full gap-6">
        <TaskColumn
          status="todo"
          title={t('board.columns.todo')}
          tasks={localTasks.todo}
          usersMap={usersMap}
        />
        <TaskColumn
          status="in_progress"
          title={t('board.columns.in_progress')}
          tasks={localTasks.in_progress}
          usersMap={usersMap}
        />
        <TaskColumn
          status="done"
          title={t('board.columns.done')}
          tasks={localTasks.done}
          usersMap={usersMap}
        />
      </div>

      <DragOverlay>
        {activeTask ? (
          <TaskCard
            task={activeTask}
            assignedUser={
              activeTask.assignedTo
                ? usersMap[activeTask.assignedTo]
                : undefined
            }
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
