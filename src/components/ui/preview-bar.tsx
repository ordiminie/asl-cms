'use client'

import {useTranslations} from 'next-intl'
import {ReactNode} from 'react'

import {cn} from '@/lib/utils'

/**
 * Barre d'apercu d'un contenu en cours d'edition (design system §2.2).
 *
 * Six statuts, mais **trois seulement sont persistes** (`draft`, `live`,
 * `unpublished` — la colonne `page.status`) : `dirty`, `publishing` et `error`
 * sont des etats client, derives du formulaire et de la requete en cours.
 *
 * Un statut se lit toujours a son point **et** a son libelle ecrit, jamais a
 * la couleur seule. Une erreur s'affiche en 2e ligne de la barre, jamais en
 * toast : elle doit rester lisible le temps qu'il faut.
 */
export type PreviewBarStatus =
  'draft' | 'dirty' | 'live' | 'publishing' | 'error' | 'unpublished'

const STATUS_DOT_CLASS: Record<PreviewBarStatus, string> = {
  draft: 'bg-[oklch(0.72_0.14_75)]',
  dirty: 'bg-[oklch(0.72_0.14_75)]',
  live: 'bg-[oklch(0.68_0.15_150)]',
  publishing: 'bg-[oklch(0.72_0.14_75)]',
  error: 'bg-[oklch(0.62_0.19_25)]',
  unpublished: 'bg-[oklch(0.72_0.02_250)]',
}

type PreviewBarProps = {
  status: PreviewBarStatus
  title: string
  /** Message d'echec, rendu en 2e ligne de la barre. */
  errorMessage?: string
  /** Retour vers la liste, et actions de droite. */
  back: ReactNode
  actions: ReactNode
}

export function PreviewBar({
  status,
  title,
  errorMessage,
  back,
  actions,
}: PreviewBarProps) {
  const t = useTranslations('PreviewBar')

  return (
    <div
      className="sticky top-0 z-50 bg-[oklch(0.24_0.02_250)] text-white"
      data-status={status}
    >
      <div className="mx-auto flex min-h-[104px] w-full max-w-[80rem] flex-col gap-3 px-4 py-3 sm:min-h-[68px] sm:flex-row sm:items-center sm:gap-4 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {back}
          <span className="min-w-0 truncate text-[15px] font-semibold">
            {title}
          </span>
          <span
            className="flex shrink-0 items-center gap-2 text-[14px]"
            aria-live="polite"
          >
            <span
              aria-hidden="true"
              className={cn('size-2 rounded-full', STATUS_DOT_CLASS[status])}
            />
            {t(status)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>

      {errorMessage && (
        <p
          className="bg-[oklch(0.3_0.06_25)] px-4 py-2 text-[14px] sm:px-6"
          role="alert"
        >
          {errorMessage}
        </p>
      )}
    </div>
  )
}
