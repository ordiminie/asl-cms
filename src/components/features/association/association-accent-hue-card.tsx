'use client'

import {CircleAlert, CircleCheck, Info} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {CSSProperties, useState} from 'react'

import type {AssociationAccentHueFormState} from '@/app/[locale]/(bureau)/bureau/identite/actions'
import {Alert, AlertDescription} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {RadioGroup, RadioGroupItem} from '@/components/ui/radio-group'
import {
  ACCENT_HUES,
  AccentHue,
  DEFAULT_ACCENT_HUE,
  getAccentHueName,
  isAccentHue,
} from '@/services/types/domain/association-settings-types'

import {AssociationMark} from './association-mark'

export type AssociationAccentHueSaveAction = (
  prevState: AssociationAccentHueFormState | undefined,
  formData: FormData
) => Promise<AssociationAccentHueFormState>

type AssociationAccentHueCardProps = {
  associationName: string
  logoVersion?: string
  /** Teinte en vigueur : celle choisie, ou la teinte par defaut. */
  appliedHue: AccentHue
  /** Faux tant que l'association n'a jamais choisi de teinte. */
  hasChosenHue: boolean
  saveAction: AssociationAccentHueSaveAction
}

type Feedback =
  | {status: 'idle'}
  | {status: 'saving'}
  | {status: 'success'; message: string}
  | {status: 'error'; message: string}

/** Pose une teinte sur un sous-arbre ; `globals.css` y recalcule les tokens. */
const hueScope = (hue: AccentHue) => ({
  'data-accent-hue-scope': '',
  style: {'--accent-hue': hue} as CSSProperties,
})

/**
 * Carte « Teinte » de la page Identite (s02, ecran A) : les six teintes
 * validees en `radio-group`, jamais de selecteur libre, chaque pastille dans
 * sa propre teinte ; un apercu qui suit la selection avant l'enregistrement ;
 * une ligne d'etat qui dit la teinte appliquee ou selectionnee.
 */
export function AssociationAccentHueCard({
  associationName,
  logoVersion,
  appliedHue: initialAppliedHue,
  hasChosenHue: initialHasChosenHue,
  saveAction,
}: AssociationAccentHueCardProps) {
  const t = useTranslations('BureauIdentityPage.accentHue')
  const tSettings = useTranslations('AssociationSettings')
  const [appliedHue, setAppliedHue] = useState(initialAppliedHue)
  const [hasChosenHue, setHasChosenHue] = useState(initialHasChosenHue)
  const [selectedHue, setSelectedHue] = useState(initialAppliedHue)
  const [feedback, setFeedback] = useState<Feedback>({status: 'idle'})
  const isSaving = feedback.status === 'saving'

  const hueName = (hue: AccentHue) => tSettings(`hues.${getAccentHueName(hue)}`)

  const statusLine = () => {
    if (selectedHue !== appliedHue) {
      return t('status.pending', {name: hueName(selectedHue)})
    }
    return hasChosenHue
      ? t('status.applied', {name: hueName(appliedHue)})
      : t('status.default', {name: hueName(appliedHue)})
  }

  const save = async () => {
    if (isSaving) return
    setFeedback({status: 'saving'})
    const formData = new FormData()
    formData.set('accentHue', String(selectedHue))

    try {
      const result = await saveAction(undefined, formData)
      if (result.success && result.accentHue !== undefined) {
        setAppliedHue(result.accentHue)
        setSelectedHue(result.accentHue)
        setHasChosenHue(true)
        setFeedback({status: 'success', message: result.message ?? ''})
        return
      }
      setFeedback({
        status: 'error',
        message: result.message ?? t('errors.notSaved'),
      })
    } catch {
      setFeedback({status: 'error', message: t('errors.notSaved')})
    }
  }

  return (
    <Card className="gap-4 px-4 py-4 shadow-none sm:px-6 sm:py-6">
      <CardHeader className="gap-1 px-0">
        <CardTitle>
          <h3
            id="accent-hue-title"
            className="text-xl leading-snug font-semibold"
          >
            {tSettings('fields.accentHue.label')}
          </h3>
        </CardTitle>
        <CardDescription className="text-[17px]">
          {tSettings('fields.accentHue.help')}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 px-0">
        <p
          aria-live="polite"
          className="text-foreground text-[17px] font-semibold"
        >
          {statusLine()}
        </p>

        <RadioGroup
          aria-labelledby="accent-hue-title"
          value={String(selectedHue)}
          disabled={isSaving}
          className="grid grid-cols-1 gap-3 lg:grid-cols-3"
          onValueChange={(value) => {
            const hue = Number(value)
            if (isAccentHue(hue)) setSelectedHue(hue)
          }}
        >
          {ACCENT_HUES.map(({hue}) => (
            <label
              key={hue}
              htmlFor={`accent-hue-${hue}`}
              className="has-[[data-state=checked]]:border-primary flex min-h-14 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 has-[[data-state=checked]]:border-2"
            >
              <RadioGroupItem
                id={`accent-hue-${hue}`}
                value={String(hue)}
                className="size-5"
              />
              <span
                aria-hidden="true"
                data-testid="accent-hue-swatch"
                className="bg-accent-solid size-6 shrink-0 rounded-sm"
                {...hueScope(hue)}
              />
              <span className="flex flex-col">
                <span className="text-[17px] font-medium">{hueName(hue)}</span>
                {hue === DEFAULT_ACCENT_HUE && (
                  <span className="text-muted-foreground text-[15px]">
                    {t('defaultBadge')}
                  </span>
                )}
              </span>
            </label>
          ))}
        </RadioGroup>

        <HuePreview
          hue={selectedHue}
          associationName={associationName}
          logoVersion={logoVersion}
        />

        <HueFeedback feedback={feedback} keptName={hueName(appliedHue)} />

        <Button
          type="button"
          disabled={isSaving}
          className="h-14 w-full sm:h-12 sm:w-auto sm:min-w-60 sm:self-start"
          onClick={save}
        >
          {isSaving ? t('saving') : t('submit')}
        </Button>
      </CardContent>
    </Card>
  )
}

function HuePreview({
  hue,
  associationName,
  logoVersion,
}: {
  hue: AccentHue
  associationName: string
  logoVersion?: string
}) {
  const t = useTranslations('BureauIdentityPage.accentHue')
  return (
    <figure
      aria-hidden="true"
      data-testid="accent-hue-preview"
      className="flex flex-col gap-2"
      {...hueScope(hue)}
    >
      <figcaption className="text-muted-foreground font-mono text-xs font-semibold tracking-widest uppercase">
        {t('previewCaption')}
      </figcaption>
      <div className="bg-background flex flex-col gap-4 rounded-md border p-4">
        <AssociationMark
          name={associationName}
          logoVersion={logoVersion}
          size="public"
        />
        <div className="text-muted-foreground flex gap-6 border-b text-[15px]">
          <span className="pb-2">{t('previewNav.home')}</span>
          <span className="border-accent-solid text-foreground border-b-3 pb-2">
            {t('previewNav.news')}
          </span>
          <span className="pb-2">{t('previewNav.contact')}</span>
        </div>
        <div className="bg-accent border-accent-border text-accent-foreground flex gap-3 rounded-md border p-3">
          <Info
            aria-hidden="true"
            className="mt-1 size-5 shrink-0"
            strokeWidth={1.75}
          />
          <p className="text-[17px]">{t('previewNotice')}</p>
        </div>
      </div>
    </figure>
  )
}

function HueFeedback({
  feedback,
  keptName,
}: {
  feedback: Feedback
  keptName: string
}) {
  const t = useTranslations('BureauIdentityPage.accentHue')

  if (feedback.status === 'success') {
    return (
      <Alert role="status">
        <CircleCheck className="text-primary" strokeWidth={1.75} />
        <AlertDescription className="text-foreground text-[17px]">
          {feedback.message}
        </AlertDescription>
      </Alert>
    )
  }

  if (feedback.status !== 'error') return null

  return (
    <Alert variant="destructive" className="border-destructive">
      <CircleAlert strokeWidth={1.75} />
      <AlertDescription className="text-foreground text-[17px]">
        <p>
          {feedback.message}{' '}
          <strong>{t('errors.kept', {name: keptName})}</strong>{' '}
          {t('errors.retry')}
        </p>
      </AlertDescription>
    </Alert>
  )
}
