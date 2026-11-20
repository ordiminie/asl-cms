'use client'

import {AlertTriangle, CircleCheck, Download} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {useEffect, useId, useRef, useState} from 'react'

import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {Label} from '@/components/ui/label'
import {RadioGroup, RadioGroupItem} from '@/components/ui/radio-group'
import {cn} from '@/lib/utils'
import {joinParcelNumbers} from '@/services/rules/campaign-rules'
import type {CampaignLetterGrouping} from '@/services/types/domain/campaign-types'

import {
  CAMPAIGN_LETTER_CALIBRATION_PATH,
  campaignLettersPathOf,
} from './campaign-paths'

type HomonymGroup = {
  name: string
  profileCount: number
  parcelNumbers: string[]
}

type CampaignLetterDownloadProps = {
  campaignId: string
  homonymGroups: readonly HomonymGroup[]
  /** Les fiches figees pour le courrier : une lettre chacune par terrain. */
  profileCount: number
}

type Status =
  | {kind: 'idle'}
  | {kind: 'missing'}
  | {kind: 'loading'}
  | {kind: 'error'}
  | {kind: 'success'; count: number; grouped: string}

const SETTINGS_PATH = '/bureau/reglages'
const FALLBACK_FILE_NAME = 'courrier.pdf'
const FILE_NAME_PATTERN = /filename="([^"]+)"/

const GROUPINGS: CampaignLetterGrouping[] = ['per_person', 'per_land']

const NAME_LIST_FORMAT = new Intl.ListFormat('fr', {
  style: 'long',
  type: 'conjunction',
})

const saveBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

/**
 * Le choix du regroupement et le telechargement du courrier (s28, design
 * s28) : aucune option presélectionnee, le PDF demande a la route puis
 * enregistre par le navigateur. La page de calage est un simple lien.
 */
export function CampaignLetterDownload({
  campaignId,
  homonymGroups,
  profileCount,
}: CampaignLetterDownloadProps) {
  const t = useTranslations('CampaignsBureau.letters')
  const [grouping, setGrouping] = useState<CampaignLetterGrouping | null>(null)
  const [status, setStatus] = useState<Status>({kind: 'idle'})
  const summaryRef = useRef<HTMLDivElement>(null)
  const fieldId = useId()
  const groupId = `${fieldId}-grouping`
  const errorId = `${fieldId}-grouping-error`
  const hasHomonyms = homonymGroups.length > 0
  const missing = status.kind === 'missing'

  useEffect(() => {
    if (missing) summaryRef.current?.focus()
  }, [missing])

  const letterCountOf = (choice: CampaignLetterGrouping | null) =>
    choice === 'per_person'
      ? profileCount -
        homonymGroups.reduce((sum, group) => sum + group.profileCount - 1, 0)
      : profileCount

  const onDownload = async () => {
    if (hasHomonyms && !grouping) {
      setStatus({kind: 'missing'})
      return
    }
    setStatus({kind: 'loading'})
    try {
      const response = await fetch(
        campaignLettersPathOf(campaignId, hasHomonyms ? grouping : null)
      )
      if (!response.ok) throw new Error(String(response.status))
      const fileName =
        FILE_NAME_PATTERN.exec(
          response.headers.get('Content-Disposition') ?? ''
        )?.[1] ?? FALLBACK_FILE_NAME
      saveBlob(await response.blob(), fileName)
      setStatus({
        kind: 'success',
        count: letterCountOf(hasHomonyms ? grouping : null),
        grouped:
          grouping === 'per_person' && hasHomonyms
            ? NAME_LIST_FORMAT.format(homonymGroups.map((group) => group.name))
            : 'none',
      })
    } catch {
      setStatus({kind: 'error'})
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {missing && (
        <Alert
          ref={summaryRef}
          tabIndex={-1}
          variant="destructive"
          role="alert"
          className="border-2"
        >
          <AlertTriangle aria-hidden="true" />
          <AlertTitle className="text-[15px] whitespace-normal">
            {t('missing.title')}
          </AlertTitle>
          <AlertDescription className="text-[15px]">
            <p>
              {t.rich('missing.description', {
                link: (chunks) => (
                  <a href={`#${groupId}`} className="underline">
                    {chunks}
                  </a>
                ),
              })}
            </p>
          </AlertDescription>
        </Alert>
      )}

      {hasHomonyms && (
        <div className="flex flex-col gap-3">
          <p id={`${groupId}-legend`} className="text-[17px] font-medium">
            {t('grouping.legend')}
          </p>
          <RadioGroup
            id={groupId}
            value={grouping ?? ''}
            onValueChange={(value) => {
              setGrouping(value as CampaignLetterGrouping)
              if (missing) setStatus({kind: 'idle'})
            }}
            aria-labelledby={`${groupId}-legend`}
            aria-invalid={missing ? true : undefined}
            aria-describedby={missing ? errorId : undefined}
            className="gap-3"
          >
            {GROUPINGS.map((value) => (
              <div
                key={value}
                className={cn(
                  'flex min-h-14 items-start gap-3 rounded-md border px-4 py-3 sm:min-h-12',
                  missing && 'border-destructive border-2'
                )}
              >
                <RadioGroupItem
                  value={value}
                  id={`${groupId}-${value}`}
                  aria-describedby={`${groupId}-${value}-help`}
                  className="mt-1 size-5"
                />
                <div className="flex flex-col">
                  <Label
                    htmlFor={`${groupId}-${value}`}
                    className="text-[17px]"
                  >
                    {t(
                      value === 'per_person'
                        ? 'grouping.perPerson'
                        : 'grouping.perLand'
                    )}
                  </Label>
                  <p
                    id={`${groupId}-${value}-help`}
                    className="text-muted-foreground text-[15px]"
                  >
                    {value === 'per_person'
                      ? t('grouping.perPersonHelp', {
                          parcels: joinParcelNumbers(
                            homonymGroups[0].parcelNumbers
                          ),
                        })
                      : t('grouping.perLandHelp')}
                  </p>
                </div>
              </div>
            ))}
          </RadioGroup>
          {missing && (
            <p id={errorId} className="text-destructive text-[15px]">
              {t('grouping.error')}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          onClick={onDownload}
          disabled={status.kind === 'loading'}
          className="h-14 w-full text-[17px] sm:h-12 sm:w-auto"
        >
          <Download aria-hidden="true" className="size-5" />
          {status.kind === 'loading' ? t('preparing') : t('download')}
        </Button>
        <Button
          asChild
          variant="outline"
          className="h-14 w-full text-[17px] sm:h-12 sm:w-auto"
        >
          <a href={CAMPAIGN_LETTER_CALIBRATION_PATH} download>
            <Download aria-hidden="true" className="size-5" />
            {t('calibration')}
          </a>
        </Button>
      </div>
      <p className="text-muted-foreground text-[15px]">
        {t.rich('calibrationHelp', {
          link: (chunks) => (
            <Link href={SETTINGS_PATH} className="underline">
              {chunks}
            </Link>
          ),
        })}
      </p>

      {status.kind === 'error' && (
        <Alert variant="destructive" role="alert" className="border-2">
          <AlertTriangle aria-hidden="true" />
          <AlertDescription className="text-[15px]">
            <p>{t('error')}</p>
          </AlertDescription>
        </Alert>
      )}
      {status.kind === 'success' && (
        <Alert role="status">
          <CircleCheck aria-hidden="true" className="text-primary" />
          <AlertDescription className="text-foreground text-[17px]">
            <p>
              {t('success', {count: status.count, grouped: status.grouped})}
            </p>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
