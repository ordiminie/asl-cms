import {ArrowRight, Lock, Map as MapIcon} from 'lucide-react'
import Link from 'next/link'
import {useFormatter, useTranslations} from 'next-intl'
import {type ReactNode, use, useId} from 'react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {Skeleton} from '@/components/ui/skeleton'
import {formatContentDate} from '@/lib/cms/format-content-date'
import {lastOwnershipDayOf} from '@/services/rules/parcel-ownership-rules'
import type {
  MyCurrentParcelDTO,
  MyFormerParcelDTO,
  MyParcelsDTO,
} from '@/services/types/domain/member-space-types'

/**
 * Espace membre (s46, s12d ecran C). Composants serveur, sans etat client :
 * rien ne survit a un changement d'utilisateur sur le meme navigateur. La
 * lecture arrive en promesse, deroulee derriere le `<Suspense>` de la page.
 */

const HEADING_CLASS = 'font-serif text-3xl font-semibold tracking-tight'

/** « Mes parcelles », ou la page de s46 pour un compte sans fiche (C5). */
export function MemberSpace({
  parcelsPromise,
}: {
  parcelsPromise: Promise<MyParcelsDTO | undefined>
}) {
  const parcels = use(parcelsPromise)
  const hasParcels =
    parcels !== undefined &&
    (parcels.current.length > 0 || parcels.former.length > 0)

  if (!parcels || !hasParcels) return <MemberSpaceWithoutProfile />

  return (
    <div className="space-y-6">
      <PersonalMarker current={parcels.current} />
      <Greeting name={parcels.name} />
      <MyParcelsCard parcels={parcels} />
      <SecurityCard />
    </div>
  )
}

/** Chargement : la salutation, et la carte en `skeleton`, sans marqueur. */
export function MemberSpaceLoading({name}: {name: string}) {
  const t = useTranslations('MemberSpacePage')
  const titleId = useId()

  return (
    <div className="space-y-6">
      <Greeting name={name} />
      <section aria-labelledby={titleId} aria-busy="true">
        <Card className="gap-4 px-4 py-6 shadow-none sm:px-6">
          <h2 id={titleId} className="font-serif text-xl font-semibold">
            {t('parcels.title')}
          </h2>
          <Skeleton className="bg-muted h-14 w-full" />
          <Skeleton className="bg-muted h-14 w-full" />
        </Card>
      </section>
    </div>
  )
}

/** C5 : la page de s46, pour un compte sans fiche dans cette association. */
function MemberSpaceWithoutProfile() {
  const t = useTranslations('MemberSpacePage')

  return (
    <div className="space-y-8">
      <h1 className={HEADING_CLASS}>{t('title')}</h1>
      <SecurityCard />
    </div>
  )
}

function Greeting({name}: {name: string}) {
  const t = useTranslations('MemberSpacePage')

  return <h1 className={HEADING_CLASS}>{t('greeting', {name})}</h1>
}

/** Le marqueur unique de la donnee personnelle (design system §3.4). */
function PersonalMarker({current}: {current: MyCurrentParcelDTO[]}) {
  const t = useTranslations('MemberSpacePage')
  const format = useFormatter()
  const numbers = format.list(
    current.map((parcel) => parcel.number),
    {type: 'conjunction'}
  )

  return (
    <p className="flex flex-wrap items-center gap-2 text-[15px]">
      <Lock aria-hidden="true" className="text-primary size-4" />
      <strong>{t('marker')}</strong>
      <span className="text-muted-foreground">
        · {t('markerParcels', {count: current.length, numbers})}
      </span>
    </p>
  )
}

const mono = (chunks: ReactNode) => (
  <span className="font-mono font-medium tabular-nums">{chunks}</span>
)

/** Le jour de la derniere vente : depuis quand on n'est plus proprietaire. */
const lastSaleOf = (former: MyFormerParcelDTO[]): string =>
  former.reduce(
    (latest, parcel) => (parcel.endsOn > latest ? parcel.endsOn : latest),
    former[0].endsOn
  )

function MyParcelsCard({parcels}: {parcels: MyParcelsDTO}) {
  const t = useTranslations('MemberSpacePage.parcels')
  const titleId = useId()

  return (
    <section aria-labelledby={titleId}>
      <Card className="gap-5 px-4 py-6 shadow-none sm:px-6">
        <h2 id={titleId} className="font-serif text-xl font-semibold">
          {t('title')}
        </h2>
        {parcels.current.length === 0 && (
          <p className="text-[17px]">
            {t('noLongerOwner', {
              date: formatContentDate(lastSaleOf(parcels.former)),
            })}
          </p>
        )}
        {parcels.current.length > 0 && (
          <ParcelGroup title={t('current')}>
            {parcels.current.map((parcel) => (
              <ParcelLine
                key={parcel.number}
                number={parcel.number}
                detail={t('since', {date: formatContentDate(parcel.startsOn)})}
              />
            ))}
          </ParcelGroup>
        )}
        {parcels.former.length > 0 && (
          <ParcelGroup title={t('former')}>
            {parcels.former.map((parcel) => (
              <ParcelLine
                key={`${parcel.number}-${parcel.startsOn}`}
                number={parcel.number}
                detail={t('period', {
                  from: formatContentDate(parcel.startsOn),
                  to: formatContentDate(lastOwnershipDayOf(parcel.endsOn)),
                })}
              />
            ))}
          </ParcelGroup>
        )}
        <p className="border-t pt-4 text-[17px]">
          {t('mistake')}{' '}
          <Link
            href="/contact"
            className="text-primary font-semibold underline underline-offset-4"
          >
            {t('contact')}
          </Link>
        </p>
      </Card>
    </section>
  )
}

function ParcelGroup({title, children}: {title: string; children: ReactNode}) {
  const titleId = useId()

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2">
      <h3 id={titleId} className="text-[17px] font-semibold">
        {title}
      </h3>
      <ul className="divide-y">{children}</ul>
    </section>
  )
}

function ParcelLine({
  number: parcelNumber,
  detail,
}: {
  number: string
  detail: string
}) {
  const t = useTranslations('MemberSpacePage.parcels')

  return (
    <li className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 py-2">
      <MapIcon
        aria-hidden="true"
        className="text-primary size-5 shrink-0"
        strokeWidth={1.75}
      />
      <span className="text-[17px]">
        {t.rich('parcel', {number: parcelNumber, mono})}
      </span>
      <span className="text-muted-foreground text-[17px]">{detail}</span>
    </li>
  )
}

/** La carte de s46, inchangee. */
function SecurityCard() {
  const t = useTranslations('MemberSpacePage')

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-xl">{t('security.title')}</h2>
        </CardTitle>
        <CardDescription className="text-base">
          {t('security.description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link
          href="/account"
          className="text-primary focus-visible:outline-ring inline-flex h-14 items-center gap-2 font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 sm:h-12"
        >
          {t('security.link')}
          <ArrowRight className="size-5" aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  )
}
