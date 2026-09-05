'use client'

import {useSortable} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import {Calendar, Clock, GripVertical} from 'lucide-react'
import {useLocale, useTranslations} from 'next-intl'

import {Avatar, AvatarFallback} from '@/components/ui/avatar'
import {Badge} from '@/components/ui/badge'
import {Card, CardContent, CardHeader} from '@/components/ui/card'
import {TaskDTO} from '@/services/types/domain/project-types'

interface TaskCardProps {
  task: TaskDTO
  assignedUser?: {
    id: string
    name: string | null
    email: string
  }
}

const statusColors = {
  todo: 'bg-gray-100 text-gray-800 border-gray-200',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
  done: 'bg-green-100 text-green-800 border-green-200',
}

export function TaskCard({task, assignedUser}: TaskCardProps) {
  const t = useTranslations('Tasks')
  const locale = useLocale()
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} =
    useSortable({
      id: task.id,
      data: {
        type: 'task',
        task,
      },
    })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`cursor-pointer transition-all hover:shadow-md ${
        isDragging ? 'rotate-2 opacity-50' : ''
      }`}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex-1">
          <h4 className="text-sm leading-none font-medium">{task.title}</h4>
          {task.description && (
            <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
              {task.description}
            </p>
          )}
        </div>
        <div
          suppressHydrationWarning
          suppressContentEditableWarning
          {...attributes}
          {...listeners}
          className="-m-1 cursor-grab rounded p-1 hover:bg-gray-100 active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4 text-gray-400" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Badge
              variant="secondary"
              className={`text-xs ${statusColors[task.status]}`}
            >
              {t(`card.status.${task.status}`)}
            </Badge>
            {task.dueDate && (
              <div className="text-muted-foreground flex items-center text-xs">
                <Calendar className="mr-1 h-3 w-3" />
                {new Date(task.dueDate).toLocaleDateString(locale, {
                  day: '2-digit',
                  month: '2-digit',
                })}
              </div>
            )}
          </div>
          {assignedUser && (
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs">
                {assignedUser.name?.charAt(0)?.toUpperCase() ||
                  assignedUser.email.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
        {task.createdAt && (
          <div className="text-muted-foreground mt-2 flex items-center text-xs">
            <Clock className="mr-1 h-3 w-3" />
            {t('card.createdAt')}{' '}
            {new Date(task.createdAt).toLocaleDateString(locale, {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
