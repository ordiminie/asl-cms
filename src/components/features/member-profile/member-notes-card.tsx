'use client'

import {AlertTriangle, CircleCheck} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {Suspense, use, useEffect, useRef, useState} from 'react'

import {Alert, AlertDescription} from '@/components/ui/alert'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {isoToFrenchDate} from '@/components/ui/date-field-format'
import {Skeleton} from '@/components/ui/skeleton'
import {receivedAtPartsOf} from '@/services/types/domain/contact-message-types'
import type {
  MemberNoteDTO,
  MemberNoteKind,
  MemberNotesPageDTO,
} from '@/services/types/domain/member-note-types'

import {MemberNoteDeleteDialog} from './member-note-delete-dialog'
import {MemberNoteForm} from './member-note-form'
import type {MemberNoteFormAction} from './member-note-form-validation'
import {DetailCard} from './member-profile-detail-card'
import {memberProfilePathOf} from './member-profile-paths'

/** Les quatre Server Actions du fil, passees par la page. */
export type MemberNoteActions = {
  addNoteAction: MemberNoteFormAction
  addExchangeAction: MemberNoteFormAction
  updateNoteAction: MemberNoteFormAction
  deleteNoteAction: MemberNoteFormAction
}

type MemberNotesCardProps = MemberNoteActions & {
  memberProfileId: string
  /** Le fil, lu par la page sans l'attendre : la carte le deroule. */
  notesPromise: Promise<MemberNotesPageDTO | undefined>
  /** Le jour calendaire de Paris, ISO : la date proposee a un echange. */
  today: string
}

const DATA_CLASS = 'font-mono font-medium tabular-nums'
const ACTION_CLASS = 'h-14 w-full text-base sm:h-11 sm:w-auto'

/** L'adresse d'une page du fil : la fiche, avec le parametre `notes`. */
const notesPagePathOf = (memberProfileId: string, page: number): string =>
  `${memberProfilePathOf(memberProfileId)}?notes=${page}`

/**
 * Le moment affiche d'une entree : jour et heure de saisie pour une note,
 * jour choisi seulement pour un echange (heure de Paris).
 */
export const entryMomentOf = (note: MemberNoteDTO): string => {
  if (note.kind === 'exchange') return isoToFrenchDate(note.entryDate)
  const at = receivedAtPartsOf(new Date(note.createdAt), 'fr')
  return `${at.shortDate} ${at.hour}:${at.minute}`
}

/** Le jour d'une entree, tel que ses actions le nomment. */
export const entryDayOf = (note: MemberNoteDTO): string =>
  note.kind === 'exchange'
    ? isoToFrenchDate(note.entryDate)
    : receivedAtPartsOf(new Date(note.createdAt), 'fr').shortDate

/** Le formulaire ouvert : un seul a la fois, a l'ajout ou en place. */
type OpenForm =
  {mode: 'add'; kind: MemberNoteKind} | {mode: 'edit'; note: MemberNoteDTO}

/** La phrase de la derniere action ; elle reste jusqu'a la suivante. */
type Notice = {tone: 'success' | 'error'; message: string}

/** Ce que le fil sait faire d'une entree, et le formulaire ouvert en place. */
type ThreadControls = {
  formOpen: boolean
  editing: MemberNoteDTO | null
  onAddFirst: () => void
  onEdit: (note: MemberNoteDTO) => void
  onDelete: (note: MemberNoteDTO) => void
  renderEditForm: (note: MemberNoteDTO) => React.ReactNode
}

/**
 * Carte « Notes et echanges » de la fiche (s24, ADR 050) : reservee au
 * bureau, un seul fil du plus recent au plus ancien. Le titre, la phrase et
 * les boutons s'affichent tout de suite ; le fil se streame derriere un
 * `<Suspense>`. Un seul formulaire est ouvert a la fois : les deux boutons
 * d'ajout s'effacent tant qu'il l'est.
 */
export function MemberNotesCard({
  memberProfileId,
  notesPromise,
  today,
  addNoteAction,
  addExchangeAction,
  updateNoteAction,
  deleteNoteAction,
}: MemberNotesCardProps) {
  const t = useTranslations('BureauMemberProfilesPage.detail.notes')
  const [open, setOpen] = useState<OpenForm | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [deleting, setDeleting] = useState<MemberNoteDTO | null>(null)
  const addNoteRef = useRef<HTMLButtonElement>(null)
  const addExchangeRef = useRef<HTMLButtonElement>(null)

  const openForm = (next: OpenForm) => {
    setNotice(null)
    setOpen(next)
  }

  const focusBack = useRef<MemberNoteKind | null>(null)

  // Le bouton d'ajout revient au rendu qui suit l'annulation : le focus lui
  // est rendu une fois qu'il est monte.
  useEffect(() => {
    if (open !== null || focusBack.current === null) return
    ;(focusBack.current === 'note'
      ? addNoteRef
      : addExchangeRef
    ).current?.focus()
    focusBack.current = null
  }, [open])

  const closeForm = () => {
    if (open?.mode === 'add') focusBack.current = open.kind
    setOpen(null)
  }

  const onSaved = (message: string) => {
    setOpen(null)
    setNotice({tone: 'success', message})
  }

  const confirmDelete = async (note: MemberNoteDTO) => {
    const formData = new FormData()
    formData.set('memberProfileId', memberProfileId)
    formData.set('noteId', note.id)
    formData.set('kind', note.kind)
    const result = await deleteNoteAction(undefined, formData)
    setDeleting(null)
    setNotice({
      tone: result.status === 'deleted' ? 'success' : 'error',
      message: 'message' in result ? result.message : '',
    })
  }

  const formFor = (kind: MemberNoteKind, note?: MemberNoteDTO) => (
    <MemberNoteForm
      key={note?.id ?? kind}
      memberProfileId={memberProfileId}
      kind={kind}
      note={note}
      today={today}
      action={
        note
          ? updateNoteAction
          : kind === 'note'
            ? addNoteAction
            : addExchangeAction
      }
      onCancel={closeForm}
      onSaved={onSaved}
    />
  )

  return (
    <DetailCard title={t('title')}>
      <p className="text-muted-foreground -mt-3 text-[15px]">{t('internal')}</p>
      {notice && <NoticeAlert notice={notice} />}
      {open === null ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            ref={addNoteRef}
            type="button"
            variant="outline"
            className={ACTION_CLASS}
            onClick={() => openForm({mode: 'add', kind: 'note'})}
          >
            {t('addNote')}
          </Button>
          <Button
            ref={addExchangeRef}
            type="button"
            variant="outline"
            className={ACTION_CLASS}
            onClick={() => openForm({mode: 'add', kind: 'exchange'})}
          >
            {t('addExchange')}
          </Button>
        </div>
      ) : (
        open.mode === 'add' && formFor(open.kind)
      )}
      <Suspense fallback={<NotesSkeleton />}>
        <NotesThread
          memberProfileId={memberProfileId}
          notesPromise={notesPromise}
          controls={{
            formOpen: open !== null,
            editing: open?.mode === 'edit' ? open.note : null,
            onAddFirst: () => openForm({mode: 'add', kind: 'note'}),
            onEdit: (note) => openForm({mode: 'edit', note}),
            onDelete: (note) => {
              setNotice(null)
              setDeleting(note)
            },
            renderEditForm: (note) => formFor(note.kind, note),
          }}
        />
      </Suspense>
      <MemberNoteDeleteDialog
        note={deleting}
        day={deleting ? entryDayOf(deleting) : ''}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </DetailCard>
  )
}

/**
 * La phrase de la derniere action : un succes neutre (`CircleCheck`), ou un
 * echec de suppression en `destructive`, `role="alert"`.
 */
function NoticeAlert({notice}: {notice: Notice}) {
  if (notice.tone === 'error') {
    return (
      <Alert
        variant="destructive"
        role="alert"
        className="border-destructive border-2 [&>svg]:size-5"
      >
        <AlertTriangle aria-hidden="true" />
        <AlertDescription className="text-foreground text-base">
          {notice.message}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert role="status" className="[&>svg]:size-5">
      <CircleCheck aria-hidden="true" className="text-primary" />
      <AlertDescription className="text-foreground text-base">
        {notice.message}
      </AlertDescription>
    </Alert>
  )
}

function NotesSkeleton() {
  const t = useTranslations('BureauMemberProfilesPage.detail.notes')

  return (
    <div
      className="flex flex-col gap-4"
      aria-busy="true"
      aria-label={t('loading')}
    >
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} className="h-24 w-full" />
      ))}
    </div>
  )
}

function NotesThread({
  memberProfileId,
  notesPromise,
  controls,
}: {
  memberProfileId: string
  notesPromise: Promise<MemberNotesPageDTO | undefined>
  controls: ThreadControls
}) {
  const t = useTranslations('BureauMemberProfilesPage.detail.notes')
  const notes = use(notesPromise)

  if (!notes || notes.total === 0) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-[17px]">{t('empty')}</p>
        {!controls.formOpen && (
          <div>
            <Button
              type="button"
              variant="outline"
              className={ACTION_CLASS}
              onClick={controls.onAddFirst}
            >
              {t('addFirstNote')}
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <ol aria-label={t('listLabel')} className="flex flex-col">
        {notes.items.map((note) => (
          <li
            key={note.id}
            className="border-border flex flex-col gap-2 border-t py-4 first:border-t-0 first:pt-0"
          >
            <NoteEntry note={note} controls={controls} />
          </li>
        ))}
      </ol>
      {notes.totalPages > 1 && (
        <NotesPagination memberProfileId={memberProfileId} notes={notes} />
      )}
    </div>
  )
}

function NoteEntry({
  note,
  controls,
}: {
  note: MemberNoteDTO
  controls: ThreadControls
}) {
  const t = useTranslations('BureauMemberProfilesPage.detail.notes')
  const day = entryDayOf(note)
  const editing = controls.editing?.id === note.id

  return (
    <div
      className={
        editing
          ? 'border-ring flex flex-col gap-2 rounded-md border-2 p-4'
          : 'flex flex-col gap-2'
      }
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge variant={note.kind === 'note' ? 'outline' : 'secondary'}>
          {t(`kinds.${note.kind}`)}
        </Badge>
        {note.channel && (
          <span className="text-[15px]">{`· ${t(`channels.${note.channel}`)}`}</span>
        )}
        <span className={`${DATA_CLASS} text-[15px]`}>
          {entryMomentOf(note)}
        </span>
      </div>
      {editing ? (
        controls.renderEditForm(note)
      ) : (
        <p className="text-[17px] break-words whitespace-pre-wrap">
          {note.body}
        </p>
      )}
      <p className="text-muted-foreground text-[15px]">
        {note.authorName && t('writtenBy', {name: note.authorName})}
        {note.updatedAt && <ModifiedMention updatedAt={note.updatedAt} />}
      </p>
      {!editing && (
        <div className="flex flex-wrap gap-x-4">
          <Button
            type="button"
            variant="link"
            className="h-14 px-0 text-base sm:h-11"
            aria-label={t(`editLabel.${note.kind}`, {date: day})}
            onClick={() => controls.onEdit(note)}
          >
            {t('edit')}
          </Button>
          <Button
            type="button"
            variant="link"
            className="h-14 px-0 text-base sm:h-11"
            aria-label={t(`deleteLabel.${note.kind}`, {date: day})}
            onClick={() => controls.onDelete(note)}
          >
            {t('delete')}
          </Button>
        </div>
      )}
    </div>
  )
}

function ModifiedMention({updatedAt}: {updatedAt: string}) {
  const t = useTranslations('BureauMemberProfilesPage.detail.notes')
  const at = receivedAtPartsOf(new Date(updatedAt), 'fr')

  return (
    <>
      {' · '}
      {t('modified', {date: at.shortDate, time: `${at.hour}:${at.minute}`})}
    </>
  )
}

/**
 * Pagination ecrite, par lien (`?notes=`) : un controle desactive reste
 * annonce, comme dans la liste des proprietaires.
 */
function NotesPagination({
  memberProfileId,
  notes,
}: {
  memberProfileId: string
  notes: MemberNotesPageDTO
}) {
  const t = useTranslations('BureauMemberProfilesPage.detail.notes.pagination')

  return (
    <nav
      aria-label={t('label')}
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <PageLink
        href={notesPagePathOf(memberProfileId, notes.page - 1)}
        disabled={notes.page <= 1}
        label={t('previous')}
      />
      <span className="text-muted-foreground text-[15px]">
        {t('position', {page: notes.page, total: notes.totalPages})}
      </span>
      <PageLink
        href={notesPagePathOf(memberProfileId, notes.page + 1)}
        disabled={notes.page >= notes.totalPages}
        label={t('next')}
      />
    </nav>
  )
}

function PageLink({
  href,
  disabled,
  label,
}: {
  href: string
  disabled: boolean
  label: string
}) {
  if (disabled) {
    return (
      <Button
        type="button"
        variant="outline"
        className="h-14 sm:h-11"
        disabled
        aria-disabled="true"
      >
        {label}
      </Button>
    )
  }

  return (
    <Button asChild variant="outline" className="h-14 sm:h-11">
      <Link href={href}>{label}</Link>
    </Button>
  )
}
