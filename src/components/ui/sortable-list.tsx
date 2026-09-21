'use client'

import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import {ChevronDown, ChevronUp, GripVertical} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {ReactNode, useCallback, useEffect, useRef, useState} from 'react'

import {Button} from '@/components/ui/button'

/**
 * Liste reordonnable (design system §2.4).
 *
 * Les boutons Monter/Descendre sont **toujours visibles**, jamais au survol
 * seul : le clavier et le tactile doivent atteindre exactement le meme
 * resultat que la souris. Le glisser-deposer (`@dnd-kit`) n'est qu'un confort
 * en plus — les deux chemins appellent `onReorder` avec le meme tableau.
 *
 * Le premier element garde son bouton « Monter » **visible et desactive**,
 * jamais absent : une action qui disparait deplace les cibles sous le doigt.
 */
export type SortableListRenderMeta = {
  index: number
  total: number
  isDragging: boolean
}

type SortableListProps<T> = {
  items: T[]
  getId: (item: T) => string
  /** Libelle lu a voix haute apres un deplacement. */
  getLabel: (item: T) => string
  onReorder: (nextItems: T[], moved: T) => void
  renderItem: (item: T, meta: SortableListRenderMeta) => ReactNode
  showMoveButtons?: boolean
  undoWindowMs?: number
}

export function SortableList<T>({
  items,
  getId,
  getLabel,
  onReorder,
  renderItem,
  showMoveButtons = true,
  undoWindowMs = 10_000,
}: SortableListProps<T>) {
  const t = useTranslations('SortableList')
  const [announcement, setAnnouncement] = useState('')
  const [undoState, setUndoState] = useState<{items: T[]; label: string}>()
  const undoTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current)
    },
    []
  )

  const applyMove = useCallback(
    (from: number, to: number) => {
      if (to < 0 || to >= items.length || from === to) return

      const previous = [...items]
      const next = arrayMove(items, from, to)
      const moved = items[from]
      const label = getLabel(moved)

      onReorder(next, moved)
      setAnnouncement(
        t('moved', {label, position: to + 1, total: items.length})
      )
      setUndoState({items: previous, label})

      if (undoTimer.current) clearTimeout(undoTimer.current)
      undoTimer.current = setTimeout(
        () => setUndoState(undefined),
        undoWindowMs
      )
    },
    [getLabel, items, onReorder, t, undoWindowMs]
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const {active, over} = event
    if (!over || active.id === over.id) return

    applyMove(
      items.findIndex((item) => getId(item) === active.id),
      items.findIndex((item) => getId(item) === over.id)
    )
  }

  const undo = () => {
    if (!undoState) return
    onReorder(undoState.items, undoState.items[0])
    setAnnouncement(t('undone'))
    setUndoState(undefined)
  }

  return (
    <div className="flex flex-col gap-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((item) => getId(item))}
          strategy={verticalListSortingStrategy}
        >
          <ul className="flex list-none flex-col gap-4 p-0">
            {items.map((item, index) => (
              <SortableRow
                key={getId(item)}
                id={getId(item)}
                index={index}
                total={items.length}
                label={getLabel(item)}
                showMoveButtons={showMoveButtons}
                onMoveUp={() => applyMove(index, index - 1)}
                onMoveDown={() => applyMove(index, index + 1)}
                renderItem={(isDragging) =>
                  renderItem(item, {index, total: items.length, isDragging})
                }
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {undoState && (
        <div className="bg-muted flex items-center justify-between gap-3 rounded-md px-4 py-3 text-[15px]">
          <span>{t('undoBanner', {label: undoState.label})}</span>
          <Button type="button" variant="outline" onClick={undo}>
            {t('undoAction')}
          </Button>
        </div>
      )}
    </div>
  )
}

type SortableRowProps = {
  id: string
  index: number
  total: number
  label: string
  showMoveButtons: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  renderItem: (isDragging: boolean) => ReactNode
}

function SortableRow({
  id,
  index,
  total,
  label,
  showMoveButtons,
  onMoveUp,
  onMoveDown,
  renderItem,
}: SortableRowProps) {
  const t = useTranslations('SortableList')
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} =
    useSortable({id})

  return (
    <li
      ref={setNodeRef}
      style={{transform: CSS.Transform.toString(transform), transition}}
      className="bg-card rounded-lg border"
    >
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <button
          type="button"
          className="text-muted-foreground flex size-11 shrink-0 cursor-grab items-center justify-center rounded-md"
          aria-label={t('dragHandle', {label})}
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden="true" className="size-5" />
        </button>

        <span className="text-muted-foreground font-mono text-xs tracking-widest uppercase">
          {t('position', {position: index + 1, total})}
        </span>

        {showMoveButtons && (
          <div className="ml-auto flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={index === 0}
              onClick={onMoveUp}
            >
              <ChevronUp aria-hidden="true" className="size-4" />
              {t('moveUp')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={index === total - 1}
              onClick={onMoveDown}
            >
              <ChevronDown aria-hidden="true" className="size-4" />
              {t('moveDown')}
            </Button>
          </div>
        )}
      </div>

      <div className="px-3 py-4">{renderItem(isDragging)}</div>
    </li>
  )
}
