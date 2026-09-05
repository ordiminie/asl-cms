'use client'

import {useDroppable} from '@dnd-kit/core'
import {SortableContext, verticalListSortingStrategy} from '@dnd-kit/sortable'
import {Plus} from 'lucide-react'
import {useTranslations} from 'next-intl'

import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {ScrollArea} from '@/components/ui/scroll-area'
import {TaskDTO, TaskStatus} from '@/services/types/domain/project-types'

import {TaskCard} from './task-card'

interface TaskColumnProps {
  status: TaskStatus
  title: string
  tasks: TaskDTO[]
  onAddTask?: () => void
  usersMap?: Record<string, {id: string; name: string | null; email: string}>
}

const statusColors = {
  todo: 'border-gray-200 bg-gray-50',
  in_progress: 'border-blue-200 bg-blue-50',
  done: 'border-green-200 bg-green-50',
}

export function TaskColumn({
  status,
  title,
  tasks,
  onAddTask,
  usersMap = {},
}: TaskColumnProps) {
  const t = useTranslations('TasksUi')
  const {setNodeRef, isOver} = useDroppable({
    id: status,
    data: {
      type: 'column',
      status,
    },
  })

  const taskIds = tasks.map((task) => task.id)

  return (
    <Card
      className={`flex-1 ${statusColors[status]} ${
        isOver ? 'ring-opacity-50 ring-2 ring-blue-400' : ''
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            {title} ({tasks.length})
          </CardTitle>
          {onAddTask && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onAddTask}
              className="h-8 w-8 p-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[600px]">
          <div ref={setNodeRef} className="space-y-3">
            <SortableContext
              items={taskIds}
              strategy={verticalListSortingStrategy}
            >
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  assignedUser={
                    task.assignedTo ? usersMap[task.assignedTo] : undefined
                  }
                />
              ))}
            </SortableContext>
            {tasks.length === 0 && (
              <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
                {t('emptyColumn')}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
