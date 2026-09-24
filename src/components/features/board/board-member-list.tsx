'use client'

import {CircleAlert, CircleCheck, SquareArrowOutUpRight} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {useState, useTransition} from 'react'

import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {Button} from '@/components/ui/button'
import {Card, CardContent} from '@/components/ui/card'
import {SortableList} from '@/components/ui/sortable-list'
import {
  BoardMemberDTO,
  buildPortraitAlt,
  getPersonInitials,
} from '@/services/types/domain/board-member-types'
import {contentFileUrl} from '@/services/types/domain/content-file-types'

export type BoardMemberActionResult =
  {status: 'ok'} | {status: 'error'; message: string}

type BoardMemberListProps = {
  members: BoardMemberDTO[]
  /** Parametre d'association ; `null` quand il n'est pas renseigne. */
  memberCount: number | null
  reorderAction: (orderedIds: string[]) => Promise<BoardMemberActionResult>
  removeAction: (memberId: string) => Promise<BoardMemberActionResult>
}

const PHOTO_SIZE = 56

/**
 * Ecran « Membres du bureau » (design s06, ecran 1).
 *
 * `<SortableList />` est repris **tel quel** (livre par s04) : poignee et
 * boutons Monter/Descendre toujours visibles, rang ecrit, annonce `aria-live`,
 * bande d'annulation de 10 s. Le deplacement est ecrit **immediatement** ; la
 * suppression, elle, est irreversible et passe par un `alert-dialog` **avant**.
 *
 * Succes et echecs s'ecrivent dans la page, ancres au-dessus de la liste,
 * jamais en toast (design system §5).
 */
export function BoardMemberList({
  members,
  memberCount,
  reorderAction,
  removeAction,
}: BoardMemberListProps) {
  const t = useTranslations('BureauBoardPage')
  const [items, setItems] = useState(members)
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [, startTransition] = useTransition()

  const apply = (
    run: () => Promise<BoardMemberActionResult>,
    fallback: string
  ) => {
    startTransition(async () => {
      try {
        const result = await run()
        if (result.status === 'error') setError(result.message)
      } catch {
        setError(fallback)
      }
    })
  }

  const reorder = (nextItems: BoardMemberDTO[]) => {
    setError(undefined)
    setNotice(undefined)
    setItems(nextItems)
    apply(
      () => reorderAction(nextItems.map((item) => item.id)),
      t('errors.reorderFailed')
    )
  }

  const remove = (member: BoardMemberDTO) => {
    setError(undefined)
    const remaining = items.filter((item) => item.id !== member.id)
    setItems(remaining)
    setNotice(
      remaining.length === 0
        ? t('list.removedLastNotice')
        : t('list.removedNotice', {count: remaining.length})
    )
    apply(() => removeAction(member.id), t('errors.removeFailed'))
  }

  return (
    <div className="flex w-full max-w-190 flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="font-serif text-[34px] leading-tight font-semibold text-pretty">
          {t('title')}
        </h1>
        <Button asChild className="h-14 w-full sm:h-12 sm:w-auto">
          <Link href="/bureau/le-bureau/nouveau">{t('add')}</Link>
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {memberCount !== null && (
          <p className="text-muted-foreground text-[15px]">
            {t('memberCount', {count: memberCount})}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-muted-foreground text-[15px]">{t('publicPage')}</p>
          <Button asChild variant="outline" className="h-11">
            <Link href="/le-bureau" target="_blank" rel="noreferrer">
              <SquareArrowOutUpRight aria-hidden="true" className="size-4" />
              {t('viewPublicPage')}
              <span className="sr-only"> {t('newTab')}</span>
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="border-destructive">
          <CircleAlert strokeWidth={1.75} />
          <AlertTitle>{t('errors.title')}</AlertTitle>
          <AlertDescription className="text-foreground">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {notice && (
        <Alert>
          <CircleCheck className="text-primary" />
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      <Card className="gap-4 px-4 py-4 shadow-none sm:px-6 sm:py-6">
        <CardContent className="flex flex-col gap-4 px-0">
          {items.length === 0 ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-muted-foreground text-[17px]">{t('empty')}</p>
              <Button asChild variant="outline" className="h-14 sm:h-11">
                <Link href="/bureau/le-bureau/nouveau">{t('emptyAction')}</Link>
              </Button>
            </div>
          ) : (
            <SortableList
              items={items}
              getId={(item) => item.id}
              getLabel={(item) => item.name}
              onReorder={(nextItems) => reorder(nextItems)}
              renderItem={(item) => (
                <BoardMemberRow member={item} onRemove={() => remove(item)} />
              )}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function BoardMemberRow({
  member,
  onRemove,
}: {
  member: BoardMemberDTO
  onRemove: () => void
}) {
  const t = useTranslations('BureauBoardPage')

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <BoardMemberPhoto member={member} />
        <div className="flex flex-col">
          <span className="text-[17px] font-medium">{member.name}</span>
          <span className="text-muted-foreground text-[15px]">
            {member.roleLabel}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          asChild
          variant="outline"
          className="h-14 w-full sm:h-11 sm:w-auto"
        >
          <Link href={`/bureau/le-bureau/${member.id}`}>{t('list.edit')}</Link>
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-14 w-full sm:h-11 sm:w-auto"
            >
              {t('list.remove')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('list.deleteTitle', {name: member.name})}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t('list.deleteHelp')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('list.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={onRemove}>
                {t('list.deleteConfirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}

/**
 * Photo, ou **initiales** de la personne (design system §3.9) : jamais une
 * image cassee, jamais une silhouette. Le carre d'initiales est decoratif —
 * le nom est ecrit juste a cote.
 */
function BoardMemberPhoto({member}: {member: BoardMemberDTO}) {
  if (!member.photoKey) {
    return (
      <span
        aria-hidden="true"
        className="bg-muted text-muted-foreground flex size-14 shrink-0 items-center justify-center rounded-md font-serif text-[21px] font-semibold"
      >
        {getPersonInitials(member.name)}
      </span>
    )
  }

  return (
    <Image
      src={contentFileUrl(member.photoKey)}
      alt={buildPortraitAlt(member.name)}
      width={PHOTO_SIZE}
      height={PHOTO_SIZE}
      unoptimized
      className="size-14 shrink-0 rounded-md object-cover"
    />
  )
}
