'use client'

import {useTranslations} from 'next-intl'
import {useState} from 'react'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {Button} from '@/components/ui/button'
import type {MemberNoteDTO} from '@/services/types/domain/member-note-types'

const BUTTON_CLASS = 'h-14 w-full text-base sm:h-11 sm:w-auto'

/**
 * Confirmation de suppression d'une note ou d'un echange (s24, etat j).
 * « Garder … » vient en premier, sur mobile comme au bureau, et recoit le
 * focus a l'ouverture (`AlertDialogCancel`) ; le bouton `destructive` nomme
 * l'acte. Echap ferme sans rien supprimer.
 */
export function MemberNoteDeleteDialog({
  note,
  day,
  onCancel,
  onConfirm,
}: {
  /** L'entree a supprimer ; `null` = boite fermee. */
  note: MemberNoteDTO | null
  /** Le jour de l'entree, tel que le fil l'ecrit. */
  day: string
  onCancel: () => void
  onConfirm: (note: MemberNoteDTO) => Promise<void>
}) {
  const t = useTranslations(
    'BureauMemberProfilesPage.detail.notes.deleteDialog'
  )
  const [pending, setPending] = useState(false)

  return (
    <AlertDialog
      open={note !== null}
      onOpenChange={(open) => {
        if (!open && !pending) onCancel()
      }}
    >
      {note && (
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-2xl">
              {t(`title.${note.kind}`)}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-foreground text-base">
              {t(`description.${note.kind}`, {
                name: note.authorName ?? '',
                date: day,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row">
            <AlertDialogCancel className={BUTTON_CLASS} disabled={pending}>
              {t(`keep.${note.kind}`)}
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              className={BUTTON_CLASS}
              disabled={pending}
              onClick={async () => {
                setPending(true)
                try {
                  await onConfirm(note)
                } finally {
                  setPending(false)
                }
              }}
            >
              {pending ? t('deleting') : t(`confirm.${note.kind}`)}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  )
}
