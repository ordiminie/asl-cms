import {
  ArrowRight,
  CircleCheck,
  Droplet,
  Lock,
  Map as MapIcon,
} from 'lucide-react'
import Link from 'next/link'
import {useFormatter, useTranslations} from 'next-intl'
import {type ReactNode, Suspense, use, useId} from 'react'

import type {MyContactFormAction} from '@/components/features/member-profile/member-profile-form-validation'
import {Alert, AlertDescription} from '@/components/ui/alert'
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
import type {MyIncidentReportDTO} from '@/services/types/domain/incident-report-types'
import type {MyEmailsDTO} from '@/services/types/domain/member-email-types'
import {isOwnershipBeforeImport} from '@/services/types/domain/member-import-types'
import type {
  MyContactDTO,
  MyCurrentParcelDTO,
  MyFormerParcelDTO,
  MyInvoicePdfAction,
  MyInvoicesDTO,
  MyLandDTO,
  MyLandsDTO,
} from '@/services/types/domain/member-space-types'
import type {SharedDocumentDTO} from '@/services/types/domain/shared-document-types'

import {MyContactCard} from './my-contact-card'
import {MyEmailsCard, MyEmailsCardLoading} from './my-emails-card'
import type {MyEmailActions} from './my-emails-validation'
import {MyInvoicesCard, MyInvoicesCardLoading} from './my-invoices-card'
import {MyQuestionCard} from './my-question-card'
import {MyReportsCard, MyReportsCardLoading} from './my-reports-card'
import {
  MySharedDocumentsCard,
  MySharedDocumentsCardLoading,
} from './my-shared-documents-card'

/**
 * Espace membre (s46, s12d ecran C). Composants serveur, sans etat client :
 * rien ne survit a un changement d'utilisateur sur le meme navigateur. La
 * lecture arrive en promesse, deroulee derriere le `<Suspense>` de la page.
 */

const HEADING_CLASS = 'font-serif text-3xl font-semibold tracking-tight'

/**
 * « Mes terrains » (s53), « Mes factures » (s19), « Mes coordonnees »,
 * « Mes adresses email » (s54),
 * « Mes signalements » (s22) et « Une question pour le bureau ? » (s23), ou
 * la page de s46 pour un compte sans fiche (C5). Un compte sans parcelle
 * garde ses coordonnees (s16, C7), ses adresses et ses signalements.
 * « Documents de l'association » (s31) est rendue dans les **trois** etats :
 * tout membre authentifie la lit, compte du bureau sans fiche compris.
 */
export function MemberSpace({
  landsPromise,
  contactPromise,
  contactAction,
  emailsPromise,
  emailActions,
  reportsPromise,
  reportSent,
  questionSent = false,
  invoicesPromise,
  openInvoicePdfAction,
  sharedDocumentsPromise,
}: {
  landsPromise: Promise<MyLandsDTO | undefined>
  contactPromise: Promise<MyContactDTO | undefined>
  contactAction: MyContactFormAction
  /** « Mes adresses email » (s54), lue a part, sans etre attendue. */
  emailsPromise: Promise<MyEmailsDTO | undefined>
  emailActions: MyEmailActions
  reportsPromise: Promise<MyIncidentReportDTO[] | undefined>
  reportSent: boolean
  /** Retour d'une question envoyee (s23, A2). */
  questionSent?: boolean
  /** « Mes factures » (s19), lue a part, sans etre attendue. */
  invoicesPromise: Promise<MyInvoicesDTO | undefined>
  /** Le PDF d'une facture, relu au clic (s20). */
  openInvoicePdfAction: MyInvoicePdfAction
  /** « Documents de l'association » (s31), lue a part, sans etre attendue. */
  sharedDocumentsPromise: Promise<SharedDocumentDTO[] | undefined>
}) {
  const lands = use(landsPromise)
  const contact = use(contactPromise)
  const hasParcels =
    lands !== undefined &&
    lands.lands.some(
      (land) => land.current.length > 0 || land.former.length > 0
    )

  const documents = <MySharedDocuments promise={sharedDocumentsPromise} />

  if (!contact) {
    return <MemberSpaceWithoutProfile>{documents}</MemberSpaceWithoutProfile>
  }

  if (!lands || !hasParcels) {
    return (
      <MemberSpaceWithoutParcels>
        <MyContactCard contact={contact} action={contactAction} />
        {documents}
        <MyEmails emailsPromise={emailsPromise} actions={emailActions} />
        <MyReports reportsPromise={reportsPromise} sent={reportSent} />
        <MyQuestionCard sent={questionSent} />
      </MemberSpaceWithoutParcels>
    )
  }

  return (
    <div className="space-y-6">
      <PersonalMarker lands={lands.lands} />
      <Greeting
        name={lands.lands.length > 1 ? lands.accountName : lands.lands[0].name}
      />
      <MyLandsCard lands={lands.lands} />
      <MyInvoices
        invoicesPromise={invoicesPromise}
        openPdfAction={openInvoicePdfAction}
      />
      {documents}
      <MyContactCard contact={contact} action={contactAction} />
      <MyEmails emailsPromise={emailsPromise} actions={emailActions} />
      <MyReports reportsPromise={reportsPromise} sent={reportSent} />
      <MyQuestionCard sent={questionSent} />
      <SecurityCard />
    </div>
  )
}

/**
 * « Mes adresses email » (s54) : lue a part, derriere son propre
 * `<Suspense>` ; le reste de l'espace n'attend pas la liste.
 */
function MyEmails({
  emailsPromise,
  actions,
}: {
  emailsPromise: Promise<MyEmailsDTO | undefined>
  actions: MyEmailActions
}) {
  return (
    <Suspense fallback={<MyEmailsCardLoading />}>
      <MyEmailsList emailsPromise={emailsPromise} actions={actions} />
    </Suspense>
  )
}

function MyEmailsList({
  emailsPromise,
  actions,
}: {
  emailsPromise: Promise<MyEmailsDTO | undefined>
  actions: MyEmailActions
}) {
  const emails = use(emailsPromise)
  if (!emails) return null

  return <MyEmailsCard emails={emails} {...actions} />
}

/**
 * « Mes factures » (s19) : lue a part, derriere son propre `<Suspense>` ;
 * rien pour un compte sans fiche.
 */
function MyInvoices({
  invoicesPromise,
  openPdfAction,
}: {
  invoicesPromise: Promise<MyInvoicesDTO | undefined>
  openPdfAction: MyInvoicePdfAction
}) {
  return (
    <Suspense fallback={<MyInvoicesCardLoading />}>
      <MyInvoicesList
        invoicesPromise={invoicesPromise}
        openPdfAction={openPdfAction}
      />
    </Suspense>
  )
}

function MyInvoicesList({
  invoicesPromise,
  openPdfAction,
}: {
  invoicesPromise: Promise<MyInvoicesDTO | undefined>
  openPdfAction: MyInvoicePdfAction
}) {
  const invoices = use(invoicesPromise)
  if (!invoices) return null

  return <MyInvoicesCard invoices={invoices} openPdfAction={openPdfAction} />
}

/**
 * « Mes signalements » (s22) : lue a part, derriere son propre `<Suspense>`
 * (A3) ; le reste de l'espace n'attend pas la liste.
 */
function MyReports({
  reportsPromise,
  sent,
}: {
  reportsPromise: Promise<MyIncidentReportDTO[] | undefined>
  sent: boolean
}) {
  return (
    <Suspense fallback={<MyReportsCardLoading />}>
      <MyReportsList reportsPromise={reportsPromise} sent={sent} />
    </Suspense>
  )
}

function MyReportsList({
  reportsPromise,
  sent,
}: {
  reportsPromise: Promise<MyIncidentReportDTO[] | undefined>
  sent: boolean
}) {
  const reports = use(reportsPromise)
  if (!reports) return null

  return <MyReportsCard reports={reports} sent={sent} />
}

/**
 * « Documents de l'association » (s31) : lue a part, derriere son propre
 * `<Suspense>` ; rien si la lecture ne rend rien.
 */
function MySharedDocuments({
  promise,
}: {
  promise: Promise<SharedDocumentDTO[] | undefined>
}) {
  return (
    <Suspense fallback={<MySharedDocumentsCardLoading />}>
      <MySharedDocumentsList promise={promise} />
    </Suspense>
  )
}

function MySharedDocumentsList({
  promise,
}: {
  promise: Promise<SharedDocumentDTO[] | undefined>
}) {
  const documents = use(promise)
  if (!documents) return null

  return <MySharedDocumentsCard documents={documents} />
}

const LOADING_LINES = [0, 1, 2]

/** Chargement (1c) : la salutation, et les cartes en `skeleton`, sans marqueur. */
export function MemberSpaceLoading({name}: {name: string}) {
  const t = useTranslations('MemberSpacePage')
  const titleId = useId()
  const contactTitleId = useId()

  return (
    <div className="space-y-6">
      <Greeting name={name} />
      <section aria-labelledby={titleId} aria-busy="true">
        <Card className="gap-4 px-4 py-6 shadow-none sm:px-6">
          <h2 id={titleId} className="font-serif text-xl font-semibold">
            {t('parcels.title')}
          </h2>
          {LOADING_LINES.map((line) => (
            <Skeleton key={line} className="bg-muted h-14 w-full" />
          ))}
        </Card>
      </section>
      <section aria-labelledby={contactTitleId} aria-busy="true">
        <Card className="gap-4 px-4 py-6 shadow-none sm:px-6">
          <h2 id={contactTitleId} className="font-serif text-xl font-semibold">
            {t('contact.title')}
          </h2>
          <Skeleton className="bg-muted h-14 w-full" />
          <Skeleton className="bg-muted h-14 w-full" />
        </Card>
      </section>
    </div>
  )
}

/**
 * C5 : la page de s46, pour un compte sans fiche dans cette association, et
 * sous son titre les documents de l'association (s31).
 */
function MemberSpaceWithoutProfile({children}: {children: ReactNode}) {
  const t = useTranslations('MemberSpacePage')

  return (
    <div className="space-y-8">
      <h1 className={HEADING_CLASS}>{t('title')}</h1>
      {children}
      <SecurityCard />
    </div>
  )
}

/** C7 (s16) : une fiche sans parcelle, ni marqueur ni salutation. */
function MemberSpaceWithoutParcels({children}: {children: ReactNode}) {
  const t = useTranslations('MemberSpacePage')

  return (
    <div className="space-y-6">
      <h1 className={HEADING_CLASS}>{t('title')}</h1>
      {children}
      <SecurityCard />
    </div>
  )
}

function Greeting({name}: {name: string}) {
  const t = useTranslations('MemberSpacePage')

  return <h1 className={HEADING_CLASS}>{t('greeting', {name})}</h1>
}

const byNumber = (a: string, b: string): number =>
  a.localeCompare(b, 'fr', {numeric: true})

/**
 * Le marqueur unique de la donnee personnelle (design system §3.4) : le
 * nombre de terrains quand il y en a plusieurs, puis toutes les parcelles
 * actuelles (s53).
 */
function PersonalMarker({lands}: {lands: MyLandDTO[]}) {
  const t = useTranslations('MemberSpacePage')
  const format = useFormatter()
  const current = lands
    .flatMap((land) => land.current.map((parcel) => parcel.number))
    .sort(byNumber)
  const numbers = format.list(current, {type: 'conjunction'})
  const parcels = t('markerParcels', {count: current.length, numbers})

  return (
    <p className="flex flex-wrap items-center gap-2 text-[15px]">
      <Lock aria-hidden="true" className="text-primary size-4" />
      <strong>{t('marker')}</strong>
      <span className="text-muted-foreground">
        {lands.length > 1
          ? `· ${t('markerLands', {count: lands.length})} · ${parcels}`
          : `· ${parcels}`}
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

/**
 * « Mes terrains » (s53, ecran 1) : un seul terrain garde l'ecran de s12d,
 * plus le compteur (1b) ; plusieurs se lisent en groupes, un par fiche, dans
 * l'ordre recu (1a). Aucun identifiant de fiche, aucun selecteur.
 */
function MyLandsCard({lands}: {lands: MyLandDTO[]}) {
  const t = useTranslations('MemberSpacePage.parcels')
  const titleId = useId()
  const several = lands.length > 1

  return (
    <section aria-labelledby={titleId}>
      <Card className="gap-5 px-4 py-6 shadow-none sm:px-6">
        <h2 id={titleId} className="font-serif text-xl font-semibold">
          {t('title')}
        </h2>
        {several ? (
          <>
            <p className="text-muted-foreground text-[15px]">
              {t('together', {count: lands.length})}
            </p>
            <div className="flex flex-col divide-y">
              {lands.map((land, index) => (
                <LandGroup key={index} land={land} />
              ))}
            </div>
          </>
        ) : (
          <LandParcels land={lands[0]} />
        )}
        <p className="border-t pt-4 text-[17px]">
          {several ? t('mistakeSeveral') : t('mistake')}{' '}
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

/** Un terrain parmi plusieurs (1a) : titre par ses parcelles, « Au nom de ». */
function LandGroup({land}: {land: MyLandDTO}) {
  const t = useTranslations('MemberSpacePage.parcels')
  const format = useFormatter()
  const shown = land.current.length > 0 ? land.current : land.former
  const numbers = format.list(
    shown.map((parcel) => parcel.number),
    {type: 'conjunction'}
  )

  return (
    <div data-testid="my-land" className="flex flex-col gap-3 py-4">
      <div className="flex flex-col gap-1">
        <p className="text-[17px] font-semibold">
          {t.rich(land.current.length > 0 ? 'landTitle' : 'landFormerTitle', {
            count: shown.length,
            numbers,
            mono,
          })}
        </p>
        <p className="text-muted-foreground text-[15px]">
          {t('landName', {name: land.name})}
        </p>
      </div>
      <LandParcels land={land} grouped />
    </div>
  )
}

/**
 * Les parcelles d'un terrain : actuelles, chacune avec son compteur, puis
 * anciennes ; « Vous n'etes plus proprietaire… » quand il n'en a plus
 * d'actuelle (C3 de s12d, par groupe).
 */
function LandParcels({
  land,
  grouped = false,
}: {
  land: MyLandDTO
  grouped?: boolean
}) {
  const t = useTranslations('MemberSpacePage.parcels')

  return (
    <>
      {land.current.length === 0 && land.former.length > 0 && (
        <p className="text-[17px]">
          {t('noLongerOwner', {
            date: formatContentDate(lastSaleOf(land.former)),
          })}
        </p>
      )}
      {land.current.length > 0 && (
        <ParcelGroup title={grouped ? null : t('current')}>
          {land.current.map((parcel) => (
            <CurrentParcelLines key={parcel.number} parcel={parcel} />
          ))}
        </ParcelGroup>
      )}
      {land.former.length > 0 && (
        <ParcelGroup title={t('former')}>
          {land.former.map((parcel) => (
            <ParcelLine
              key={`${parcel.number}-${parcel.startsOn}`}
              number={parcel.number}
              detail={
                isOwnershipBeforeImport(parcel.startsOn)
                  ? t('periodBeforeImport', {
                      to: formatContentDate(lastOwnershipDayOf(parcel.endsOn)),
                    })
                  : t('period', {
                      from: formatContentDate(parcel.startsOn),
                      to: formatContentDate(lastOwnershipDayOf(parcel.endsOn)),
                    })
              }
            />
          ))}
        </ParcelGroup>
      )}
    </>
  )
}

/** Une parcelle actuelle et son compteur (s53). */
function CurrentParcelLines({parcel}: {parcel: MyCurrentParcelDTO}) {
  const t = useTranslations('MemberSpacePage.parcels')

  return (
    <>
      <ParcelLine
        number={parcel.number}
        detail={
          isOwnershipBeforeImport(parcel.startsOn)
            ? t('sinceBeforeImport')
            : t('since', {date: formatContentDate(parcel.startsOn)})
        }
      />
      <li className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 py-2">
        <Droplet
          aria-hidden="true"
          className="text-primary size-5 shrink-0"
          strokeWidth={1.75}
        />
        {parcel.meterNumber ? (
          <span className="text-[17px]">
            {t.rich('meter', {number: parcel.meterNumber, mono})}
          </span>
        ) : (
          <span className="text-muted-foreground text-[17px]">
            {t('meterMissing')}
          </span>
        )}
      </li>
    </>
  )
}

function ParcelGroup({
  title,
  children,
}: {
  title: string | null
  children: ReactNode
}) {
  const titleId = useId()

  if (title === null) return <ul className="divide-y">{children}</ul>

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

/**
 * Apres sa propre retrogradation (s14, A12) : `alert` neutre en tete de
 * l'espace personnel, sur `/dashboard?role=retire`.
 */
export function RoleWithdrawnNotice() {
  const t = useTranslations('MemberSpacePage.roleWithdrawn')

  return (
    <Alert role="status" className="[&>svg]:size-5">
      <CircleCheck aria-hidden="true" className="text-primary" />
      <AlertDescription className="text-foreground text-base">
        <p className="font-semibold">{t('title')}</p>
        <p>{t('detail')}</p>
      </AlertDescription>
    </Alert>
  )
}
