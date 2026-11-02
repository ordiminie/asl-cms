'use client'

import {LogOut, UserRoundCog} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {CSSProperties, useEffect, useState, useTransition} from 'react'

import {Button} from '@/components/ui/button'
import {reloadPageAt} from '@/lib/helper/page-navigation.client'

/** Ou atterrit le SuperAdmin quand la session a sa place a expire (D5). */
export const IMPERSONATION_EXPIRED_URL = '/login/prestataire?session=terminee'

/** Le compte a rebours s'affiche dans les deux dernieres minutes (§2.6). */
const COUNTDOWN_THRESHOLD_MS = 2 * 60 * 1000

/**
 * Magenta raye de la barre (D13) : le design system n'a pas de token pour
 * lui (gap n° 3 du design de s48, inscrit au §9). Les deux valeurs maquettees
 * vivent ici, pas dans `globals.css`. Texte blanc : 6,8:1 sur la bande claire,
 * 8,4:1 sur la sombre (AA). Les rayures sont decoratives.
 */
const STRIPES: CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(135deg, oklch(0.5 0.21 345) 0 12px, oklch(0.44 0.2 345) 12px 24px)',
}

type StopResult =
  {success: true; url: string} | {success: false; message: string}

type ImpersonationBarProps = {
  subjectName: string
  roleLabel: string
  organizationName: string
  /** Fin de la session (`session.expiresAt`), en ISO. */
  expiresAt: string
  stopAction: () => Promise<StopResult>
}

const remainingMs = (expiresAt: string) =>
  new Date(expiresAt).getTime() - Date.now()

/** Le temps qui reste, relu chaque seconde ; a zero, la page de connexion. */
function useRemaining(expiresAt: string) {
  const [remaining, setRemaining] = useState(() => remainingMs(expiresAt))

  useEffect(() => {
    const tick = () => {
      const next = remainingMs(expiresAt)
      setRemaining(next)
      if (next <= 0) reloadPageAt(IMPERSONATION_EXPIRED_URL)
    }
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [expiresAt])

  return remaining
}

/**
 * La banniere d'une session a la place d'un compte (s48, ecran 3, §2.6).
 * `sticky top-0`, z-index 60, au-dessus du bandeau d'alerte ; jamais
 * refermable, la seule sortie est « Revenir a mon compte », bouton plein
 * blanc. Entree annoncee en assertif, compte a rebours en poli.
 */
export function ImpersonationBar({
  subjectName,
  roleLabel,
  organizationName,
  expiresAt,
  stopAction,
}: ImpersonationBarProps) {
  const t = useTranslations('Impersonation.bar')
  const remaining = useRemaining(expiresAt)
  const [announced, setAnnounced] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const title = t('title', {name: subjectName})
  // Une region live n'annonce qu'un changement : le texte y est pose juste
  // apres le montage, pour que l'entree soit lue.
  useEffect(() => {
    const timer = setTimeout(() => setAnnounced(title), 100)
    return () => clearTimeout(timer)
  }, [title])

  const exit = () => {
    setError(null)
    startTransition(async () => {
      const result = await stopAction()
      if (result.success) {
        reloadPageAt(result.url)
        return
      }
      setError(result.message)
    })
  }

  const seconds = Math.max(0, Math.ceil(remaining / 1000))
  const detail =
    remaining <= COUNTDOWN_THRESHOLD_MS
      ? seconds >= 60
        ? t('countdown', {
            minutes: Math.floor(seconds / 60),
            seconds: seconds % 60,
          })
        : t('countdownSeconds', {seconds})
      : t.rich('detail', {
          role: roleLabel,
          association: organizationName,
          time: new Date(expiresAt).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          mono: (chunks) => (
            <span className="font-mono" suppressHydrationWarning>
              {chunks}
            </span>
          ),
        })

  return (
    <div
      className="sticky top-0 z-[60] text-white"
      style={STRIPES}
      data-slot="impersonation-bar"
    >
      <p className="sr-only" aria-live="assertive">
        {announced}
      </p>
      <div className="mx-auto flex max-w-[1200px] items-center gap-4 px-6 py-3 max-sm:flex-col max-sm:items-stretch max-sm:px-4">
        <UserRoundCog
          className="size-6 shrink-0 max-sm:hidden"
          aria-hidden="true"
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="font-semibold">{title}</p>
          <p className="text-base" aria-live="polite">
            {detail}
          </p>
          {error && (
            <p role="alert" className="text-base font-semibold">
              {error}
            </p>
          )}
        </div>
        <Button
          type="button"
          onClick={exit}
          disabled={isPending}
          className="text-foreground bg-white hover:bg-white/90 max-sm:h-14 max-sm:w-full"
        >
          <LogOut className="size-5" aria-hidden="true" />
          {t('exit')}
        </Button>
      </div>
    </div>
  )
}
