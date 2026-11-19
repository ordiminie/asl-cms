'use client'

import {AlertTriangle, CircleCheck, Info, RefreshCw} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {type ReactNode, useId, useState, useTransition} from 'react'

import {syncTimePartsOf} from '@/components/features/member-invoice/billing-sync-format'
import {memberProfilePathOf} from '@/components/features/member-profile/member-profile-paths'
import {Alert, AlertDescription} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {Skeleton} from '@/components/ui/skeleton'
import type {
  BillingSyncCounts,
  BillingSyncOverviewDTO,
  PennylaneSyncAction,
  PennylaneSyncActionState,
} from '@/services/types/domain/billing-sync-types'

const DATA_CLASS = 'font-mono font-medium tabular-nums'

/** Les comptes, dans l'ordre du design : remontees, puis ecartees par motif. */
const COUNT_LINES = [
  'written',
  'draft',
  'creditNote',
  'noCustomer',
  'noDate',
  'notEur',
  'nonPositive',
  'unmatched',
] as const satisfies readonly (keyof BillingSyncCounts)[]

/**
 * Carte « Synchronisation Pennylane » des reglages (s20, ecran 3, critere 3) :
 * une carte d'etat placee apres « Factures », rendue sous Pennylane seulement
 * (design system, gap 1). Derniere mise a jour ou echec avec son motif,
 * comptes, fiches sans identifiant, clients Pennylane sans fiche, ecarts de
 * terrain, et « Mettre a jour maintenant ». Le bouton n'envoie pas le
 * formulaire des reglages : il appelle sa propre action.
 */
export function PennylaneSyncCard({
  overview,
  syncAction,
}: {
  overview: BillingSyncOverviewDTO
  syncAction: PennylaneSyncAction
}) {
  const t = useTranslations('BureauSettingsPage.pennylaneSync')
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<PennylaneSyncActionState | null>(null)

  const syncNow = () =>
    startTransition(async () => {
      setResult(await syncAction())
    })

  return (
    <Card className="gap-4 px-4 py-4 shadow-none sm:px-6 sm:py-6">
      <CardHeader className="px-0">
        <CardTitle>
          <h3 className="text-xl leading-snug font-semibold">
            {t('card.title')}
          </h3>
        </CardTitle>
        <p className="text-muted-foreground text-base">
          {t('card.description')}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 px-0" aria-busy={pending}>
        <SyncStatus overview={overview} />
        {result && (
          <p role="status" className="text-base">
            {result.message}
          </p>
        )}
        {overview.counts && (
          <Counts counts={overview.counts} pending={pending} />
        )}
        <ProfilesWithoutId profiles={overview.profilesWithoutId} />
        {overview.unmatchedCustomers.length > 0 && (
          <Section title={t('card.unmatchedCustomers')}>
            {overview.unmatchedCustomers.map((customer) => (
              <li key={customer.id} className="flex flex-col">
                {customer.reference && (
                  <span className={DATA_CLASS}>{customer.reference}</span>
                )}
                <span>{customer.name || t('card.unnamedCustomer')}</span>
              </li>
            ))}
          </Section>
        )}
        {overview.terrainMismatches.length > 0 && (
          <Section title={t('card.terrainMismatches')}>
            {overview.terrainMismatches.map((mismatch) => (
              <li
                key={`${mismatch.invoiceNumber}-${mismatch.memberProfileId}`}
                className="flex flex-col"
              >
                <span>
                  {t('card.terrainMismatch', {
                    invoice: mismatch.invoiceNumber,
                    parcels: mismatch.parcels.join(', '),
                    meter: mismatch.meter ?? t('card.noMeter'),
                  })}
                </span>
                <Link
                  href={memberProfilePathOf(mismatch.memberProfileId)}
                  className="text-primary font-semibold underline underline-offset-4"
                >
                  {mismatch.memberProfileName}
                </Link>
              </li>
            ))}
          </Section>
        )}
        <Button
          type="button"
          variant="outline"
          className="h-14 w-full text-base sm:h-12 sm:w-auto sm:self-start"
          disabled={pending}
          onClick={syncNow}
        >
          <RefreshCw aria-hidden="true" />
          {pending ? t('card.syncing') : t('card.syncNow')}
        </Button>
      </CardContent>
    </Card>
  )
}

function SyncStatus({overview}: {overview: BillingSyncOverviewDTO}) {
  const t = useTranslations('BureauSettingsPage.pennylaneSync')

  if (overview.lastError) {
    return (
      <Alert className="border-warning-border bg-warning text-warning-foreground border-2 [&>svg]:size-5">
        <AlertTriangle aria-hidden="true" />
        <AlertDescription className="text-warning-foreground text-base">
          {overview.lastError === 'missing_key'
            ? t('errors.missing_key')
            : `${t('card.failed')} ${t(`errors.${overview.lastError}`)} ${t('card.retry')}`}
        </AlertDescription>
      </Alert>
    )
  }
  if (!overview.syncedAt) {
    return (
      <Alert className="bg-muted [&>svg]:size-5">
        <Info aria-hidden="true" />
        <AlertDescription className="text-foreground text-base">
          {t('card.never')}
        </AlertDescription>
      </Alert>
    )
  }
  return (
    <Alert className="[&>svg]:size-5">
      <CircleCheck aria-hidden="true" className="text-primary" />
      <AlertDescription className="text-foreground text-base">
        {t('card.syncedAt', syncTimePartsOf(overview.syncedAt))}
      </AlertDescription>
    </Alert>
  )
}

function Counts({
  counts,
  pending,
}: {
  counts: BillingSyncCounts
  pending: boolean
}) {
  const t = useTranslations('BureauSettingsPage.pennylaneSync')
  const labelId = useId()

  return (
    <div className="flex flex-col gap-2">
      <p id={labelId} className="sr-only">
        {t('card.counts')}
      </p>
      <ul aria-labelledby={labelId} className="flex flex-col gap-2 text-[17px]">
        {COUNT_LINES.map((line) => (
          <li key={line} className="flex justify-between gap-4">
            <span className="text-muted-foreground">
              {t(`card.countLabels.${line}`)}
            </span>
            {pending ? (
              <Skeleton className="bg-muted h-5 w-12" />
            ) : (
              <span className={DATA_CLASS}>{counts[line]}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ProfilesWithoutId({
  profiles,
}: {
  profiles: BillingSyncOverviewDTO['profilesWithoutId']
}) {
  const t = useTranslations('BureauSettingsPage.pennylaneSync')

  if (profiles.length === 0) {
    return <p className="text-[17px]">{t('card.allLinked')}</p>
  }
  return (
    <Section title={t('card.profilesWithoutId', {count: profiles.length})}>
      {profiles.map((profile) => (
        <li key={profile.id}>
          <Link
            href={memberProfilePathOf(profile.id)}
            className="text-primary font-semibold underline underline-offset-4"
          >
            {profile.name}
          </Link>
        </li>
      ))}
    </Section>
  )
}

function Section({title, children}: {title: string; children: ReactNode}) {
  const titleId = useId()

  return (
    <div className="flex flex-col gap-2">
      <h4 id={titleId} className="text-base font-semibold">
        {title}
      </h4>
      <ul aria-labelledby={titleId} className="flex flex-col gap-2 text-[17px]">
        {children}
      </ul>
    </div>
  )
}
