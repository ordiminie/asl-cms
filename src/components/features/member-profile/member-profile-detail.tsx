'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {AlertTriangle, CircleCheck} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import {FormProvider, useForm} from 'react-hook-form'

import {Alert, AlertDescription} from '@/components/ui/alert'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
import {isoToFrenchDate} from '@/components/ui/date-field'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {lastOwnershipDayOf} from '@/services/rules/parcel-ownership-rules'
import type {MemberProfileDTO} from '@/services/types/domain/member-profile-types'
import type {
  CurrentParcelDTO,
  FormerParcelDTO,
  MemberParcelsDTO,
} from '@/services/types/domain/parcel-ownership-types'

import {
  type AttachedParcel,
  AttachParcelDialog,
  type AttachParcelFormAction,
} from './attach-parcel-dialog'
import {
  MemberContactFields,
  MemberFormErrorSummary,
} from './member-contact-fields'
import {IncompleteBadge, MailOnlyBadge} from './member-profile-badges'
import {EmailHolder, type MemberProfileFormAction} from './member-profile-form'
import {
  createMemberContactFormSchema,
  MEMBER_CONTACT_FORM_FIELDS,
  type MemberContactFormSchemaType,
  type MemberProfileFormField,
} from './member-profile-form-validation'
import {
  MEMBER_PROFILES_PATH,
  memberProfilePathOf,
  salePathOf,
} from './member-profile-paths'

type MemberProfileDetailProps = {
  profile: MemberProfileDTO
  parcels: MemberParcelsDTO
  /** Le jour calendaire de Paris, ISO : la date proposee au rattachement. */
  today: string
  /** La fiche vient d'etre creee : le dire une fois. */
  created: boolean
  /** La parcelle dont la vente vient d'etre enregistree : le dire une fois. */
  soldParcelId?: string
  updateContactAction: MemberProfileFormAction
  attachParcelAction: AttachParcelFormAction
}

type Notice =
  | {kind: 'created'}
  | {kind: 'contactSaved'}
  | {kind: 'attached'; parcel: AttachedParcel}
  | {kind: 'sold'; parcel: FormerParcelDTO}

/** Ce que la fiche dit a l'arrivee : une creation, ou une vente enregistree. */
const arrivalNoticeOf = (input: {
  created: boolean
  soldParcelId?: string
  parcels: MemberParcelsDTO
}): Notice | null => {
  if (input.created) return {kind: 'created'}

  const sold = input.parcels.former
    .filter((parcel) => parcel.parcelId === input.soldParcelId)
    .sort((a, b) => b.endsOn.localeCompare(a.endsOn))[0]
  return sold ? {kind: 'sold', parcel: sold} : null
}

type Editing = {focus?: MemberProfileFormField}

const DATA_CLASS = 'font-mono font-medium tabular-nums'

/**
 * Fiche d'un proprietaire (ecran 3 du design s12) : ses coordonnees,
 * modifiables en place, et ses parcelles, presentes et passees. La carte
 * « Acces a l'espace membre » n'est pas ici : s12 n'ouvre aucun compte (s12d) ;
 * « courrier uniquement » se lit dans les badges.
 */
export function MemberProfileDetail({
  profile,
  parcels,
  today,
  created,
  soldParcelId,
  updateContactAction,
  attachParcelAction,
}: MemberProfileDetailProps) {
  const t = useTranslations('BureauMemberProfilesPage')
  const [editing, setEditing] = useState<Editing | null>(null)
  const [attaching, setAttaching] = useState(false)
  const [pageNotice, setPageNotice] = useState<Notice | null>(null)
  const noticeRef = useRef<HTMLDivElement>(null)
  // Next conserve la fiche montee entre deux navigations (`<Activity>`, sans
  // egard aux parametres de recherche) : l'alerte d'arrivee se lit donc dans
  // les props de l'URL courante, jamais dans un etat fige au montage.
  const notice = pageNotice ?? arrivalNoticeOf({created, soldParcelId, parcels})

  useEffect(() => {
    if (pageNotice) noticeRef.current?.focus()
  }, [pageNotice])

  // Une alerte nee dans la page ne survit pas au depart : `<Activity>` joue ce
  // nettoyage quand il masque la fiche.
  useLayoutEffect(() => () => setPageNotice(null), [])

  return (
    <div className="mx-auto flex w-full max-w-240 flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <Breadcrumb aria-label={t('breadcrumb.label')}>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={MEMBER_PROFILES_PATH}>{t('breadcrumb.list')}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{profile.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {notice && (
        <NoticeAlert ref={noticeRef} notice={notice} name={profile.name} />
      )}

      {profile.incomplete && !editing && (
        <Alert className="border-warning-border bg-warning text-warning-foreground border-2 [&>svg]:size-5">
          <AlertTriangle aria-hidden="true" />
          <AlertDescription className="text-warning-foreground gap-3 text-base">
            <p>
              <strong>{t('detail.attention')}</strong> {t('detail.incomplete')}
            </p>
            <Button
              type="button"
              variant="outline"
              className="h-14 w-full text-base sm:h-11 sm:w-auto"
              onClick={() => setEditing({focus: 'addressLine'})}
            >
              {t('detail.addPostalAddress')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-[34px] leading-tight font-semibold">
          {profile.name}
        </h1>
        {profile.mailOnly && (
          <div className="flex flex-wrap items-center gap-2">
            <MailOnlyBadge />
            {profile.incomplete && <IncompleteBadge />}
          </div>
        )}
      </div>

      <DetailCard title={t('detail.contact.title')}>
        {editing ? (
          <ContactForm
            profile={profile}
            focus={editing.focus}
            action={updateContactAction}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null)
              setPageNotice({kind: 'contactSaved'})
            }}
          />
        ) : (
          <ContactView profile={profile} onEdit={() => setEditing({})} />
        )}
      </DetailCard>

      <DetailCard
        title={t('detail.parcels.title')}
        action={
          <Button
            type="button"
            variant="outline"
            className="h-14 w-full text-base sm:h-11 sm:w-auto"
            onClick={() => setAttaching(true)}
          >
            {t('detail.parcels.attach')}
          </Button>
        }
      >
        <CurrentParcels
          memberProfileId={profile.id}
          parcels={parcels.current}
        />
        {parcels.former.length > 0 && (
          <FormerParcels parcels={parcels.former} />
        )}
      </DetailCard>

      <AttachParcelDialog
        profile={profile}
        today={today}
        open={attaching}
        onClose={() => setAttaching(false)}
        onAttached={(parcel) => {
          setAttaching(false)
          setPageNotice({kind: 'attached', parcel})
        }}
        action={attachParcelAction}
      />
    </div>
  )
}

function NoticeAlert({
  ref,
  notice,
  name,
}: {
  ref: React.Ref<HTMLDivElement>
  notice: Notice
  name: string
}) {
  return (
    <Alert ref={ref} tabIndex={-1} role="status" className="[&>svg]:size-5">
      <CircleCheck aria-hidden="true" className="text-primary" />
      <AlertDescription className="text-foreground text-base">
        <NoticeMessage notice={notice} name={name} />
      </AlertDescription>
    </Alert>
  )
}

function NoticeMessage({notice, name}: {notice: Notice; name: string}) {
  const t = useTranslations('BureauMemberProfilesPage')

  if (notice.kind === 'attached') {
    return t(
      notice.parcel.parcelCreated
        ? 'detail.parcels.attachedCreated'
        : 'detail.parcels.attached',
      {
        number: notice.parcel.parcelNumber,
        name,
        date: isoToFrenchDate(notice.parcel.startsOn),
      }
    )
  }

  if (notice.kind === 'sold') {
    const {soldTo} = notice.parcel
    return (
      <>
        <p>
          {t('detail.sold', {
            number: notice.parcel.number,
            name: soldTo?.name ?? '',
            date: isoToFrenchDate(notice.parcel.endsOn),
          })}
        </p>
        {soldTo && (
          <Link
            href={memberProfilePathOf(soldTo.memberProfileId)}
            className="underline underline-offset-4"
          >
            {t('openProfileOf', {name: soldTo.name})}
          </Link>
        )}
      </>
    )
  }

  return t(`detail.${notice.kind}`)
}

function DetailCard({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  const titleId = useId()

  return (
    <section aria-labelledby={titleId}>
      <Card className="gap-5 px-4 py-6 shadow-none sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id={titleId} className="font-serif text-2xl font-semibold">
            {title}
          </h2>
          {action}
        </div>
        {children}
      </Card>
    </section>
  )
}

/** Paires libelle / valeur ; absente = « Non renseignee » / « Non renseigne ». */
function ContactView({
  profile,
  onEdit,
}: {
  profile: MemberProfileDTO
  onEdit: () => void
}) {
  const t = useTranslations('BureauMemberProfilesPage.detail.contact')
  const locality = [profile.postalCode, profile.city]
    .filter((part): part is string => Boolean(part))
    .join(' ')
  const addressLines = [
    profile.addressLine,
    profile.addressComplement,
    locality,
  ].filter((line): line is string => Boolean(line))

  return (
    <>
      <dl className="grid gap-x-6 gap-y-3 text-[17px] sm:grid-cols-[12rem_1fr]">
        <dt className="text-muted-foreground">{t('email')}</dt>
        <dd className="break-all">
          {profile.email ?? <Missing>{t('missingFeminine')}</Missing>}
        </dd>
        <dt className="text-muted-foreground">{t('phone')}</dt>
        <dd>{profile.phone ?? <Missing>{t('missingMasculine')}</Missing>}</dd>
        <dt className="text-muted-foreground">{t('postalAddress')}</dt>
        <dd>
          {addressLines.length === 0 ? (
            <Missing>{t('missingFeminine')}</Missing>
          ) : (
            addressLines.map((line) => <div key={line}>{line}</div>)
          )}
        </dd>
      </dl>
      <div>
        <Button
          type="button"
          variant="outline"
          className="h-14 w-full text-base sm:h-11 sm:w-auto"
          onClick={onEdit}
        >
          {t('edit')}
        </Button>
      </div>
    </>
  )
}

function Missing({children}: {children: ReactNode}) {
  return <span className="text-muted-foreground">{children}</span>
}

const CONTACT_ID_PREFIX = 'member-contact'

/** Les coordonnees, modifiees en place (etat `3e`, critere 6). */
function ContactForm({
  profile,
  focus,
  action,
  onCancel,
  onSaved,
}: {
  profile: MemberProfileDTO
  focus?: MemberProfileFormField
  action: MemberProfileFormAction
  onCancel: () => void
  onSaved: () => void
}) {
  const t = useTranslations('BureauMemberProfilesPage')
  const form = useForm<MemberContactFormSchemaType>({
    resolver: zodResolver(createMemberContactFormSchema(t)),
    defaultValues: {
      email: profile.email ?? '',
      phone: profile.phone ?? '',
      addressLine: profile.addressLine ?? '',
      addressComplement: profile.addressComplement ?? '',
      postalCode: profile.postalCode ?? '',
      city: profile.city ?? '',
    },
    mode: 'onBlur',
    reValidateMode: 'onChange',
  })
  const {setFocus} = form
  const [submitted, setSubmitted] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [holder, setHolder] = useState<{id: string; name: string} | null>(null)

  useEffect(() => {
    if (focus && focus !== 'name') setFocus(focus)
  }, [focus, setFocus])

  const onValid = async (values: MemberContactFormSchemaType) => {
    setFailure(null)
    setHolder(null)
    const formData = new FormData()
    formData.set('memberProfileId', profile.id)
    for (const field of MEMBER_CONTACT_FORM_FIELDS) {
      formData.set(field, values[field])
    }

    const result = await action(undefined, formData)
    if (result.status === 'invalid') {
      for (const error of result.errors) {
        if (error.field !== 'name') {
          form.setError(error.field, {message: error.message})
        }
      }
    } else if (result.status === 'email_taken') {
      setHolder({id: result.memberProfileId, name: result.name})
    } else if (result.status === 'error') {
      setFailure(result.message)
    } else {
      onSaved()
    }
  }

  return (
    <FormProvider {...form}>
      <form
        noValidate
        onSubmit={(event) => {
          setSubmitted(true)
          return form.handleSubmit(onValid)(event)
        }}
        className="flex flex-col gap-6"
      >
        {submitted && (
          <MemberFormErrorSummary
            idPrefix={CONTACT_ID_PREFIX}
            fields={MEMBER_CONTACT_FORM_FIELDS}
          />
        )}
        {failure && (
          <Alert variant="destructive" className="border-2">
            <AlertTriangle aria-hidden="true" />
            <AlertDescription className="text-foreground text-base">
              {failure}
            </AlertDescription>
          </Alert>
        )}
        <MemberContactFields
          idPrefix={CONTACT_ID_PREFIX}
          afterEmail={
            holder && (
              <EmailHolder memberProfileId={holder.id} name={holder.name} />
            )
          }
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="h-14 w-full text-base sm:h-11 sm:w-auto"
          >
            {form.formState.isSubmitting
              ? t('detail.contact.saving')
              : t('detail.contact.save')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-14 w-full text-base sm:h-11 sm:w-auto"
            onClick={onCancel}
          >
            {t('detail.contact.cancel')}
          </Button>
        </div>
      </form>
    </FormProvider>
  )
}

/** Parcelles actuelles : chacune mene a l'enregistrement de sa vente. */
function CurrentParcels({
  memberProfileId,
  parcels,
}: {
  memberProfileId: string
  parcels: CurrentParcelDTO[]
}) {
  const t = useTranslations('BureauMemberProfilesPage.detail.parcels')

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold">{t('current')}</h3>
      {parcels.length === 0 ? (
        <p className="text-muted-foreground text-[17px]">{t('noCurrent')}</p>
      ) : (
        <>
          <div className="hidden sm:block">
            <Table aria-label={t('current')}>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('columns.parcel')}</TableHead>
                  <TableHead>{t('columns.since')}</TableHead>
                  <TableHead>{t('columns.action')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parcels.map((parcel) => (
                  <TableRow key={parcel.parcelId} className="h-14">
                    <TableCell className={DATA_CLASS}>
                      {parcel.number}
                    </TableCell>
                    <TableCell className={DATA_CLASS}>
                      {isoToFrenchDate(parcel.startsOn)}
                    </TableCell>
                    <TableCell>
                      <RecordSaleLink
                        href={salePathOf(memberProfileId, parcel.parcelId)}
                        className="h-11"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="flex flex-col gap-4 sm:hidden">
            {parcels.map((parcel) => (
              <li key={parcel.parcelId}>
                <Card className="gap-3 px-4 py-4 shadow-none">
                  <p className={`${DATA_CLASS} text-lg`}>{parcel.number}</p>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[17px]">
                    <dt className="text-muted-foreground">
                      {t('columns.since')}
                    </dt>
                    <dd className={DATA_CLASS}>
                      {isoToFrenchDate(parcel.startsOn)}
                    </dd>
                  </dl>
                  <RecordSaleLink
                    href={salePathOf(memberProfileId, parcel.parcelId)}
                    className="h-14 w-full"
                  />
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function RecordSaleLink({href, className}: {href: string; className: string}) {
  const t = useTranslations('BureauMemberProfilesPage.detail.parcels')

  return (
    <Button asChild variant="outline" className={className}>
      <Link href={href}>{t('recordSale')}</Link>
    </Button>
  )
}

/**
 * Anciennes parcelles (gap 3) : la periode s'ecrit jusqu'a **la veille** de la
 * vente, l'acquereur en lien. Aucune action : une periode close ne se modifie
 * pas.
 */
function FormerParcels({parcels}: {parcels: FormerParcelDTO[]}) {
  const t = useTranslations('BureauMemberProfilesPage.detail.parcels')

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold">{t('former')}</h3>
      <p className="text-muted-foreground text-[15px]">{t('formerNote')}</p>
      <div className="hidden sm:block">
        <Table aria-label={t('former')}>
          <TableHeader>
            <TableRow>
              <TableHead>{t('columns.parcel')}</TableHead>
              <TableHead>{t('columns.period')}</TableHead>
              <TableHead>{t('columns.soldTo')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parcels.map((parcel) => (
              <TableRow
                key={`${parcel.parcelId}-${parcel.startsOn}`}
                className="h-14"
              >
                <TableCell className={DATA_CLASS}>{parcel.number}</TableCell>
                <TableCell className={DATA_CLASS}>
                  <ClosedPeriod parcel={parcel} />
                </TableCell>
                <TableCell>
                  <Buyer parcel={parcel} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="flex flex-col gap-4 sm:hidden">
        {parcels.map((parcel) => (
          <li key={`${parcel.parcelId}-${parcel.startsOn}`}>
            <Card className="gap-3 px-4 py-4 shadow-none">
              <p className={`${DATA_CLASS} text-lg`}>{parcel.number}</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[17px]">
                <dt className="text-muted-foreground">{t('columns.period')}</dt>
                <dd className={DATA_CLASS}>
                  <ClosedPeriod parcel={parcel} />
                </dd>
                <dt className="text-muted-foreground">{t('columns.soldTo')}</dt>
                <dd>
                  <Buyer parcel={parcel} />
                </dd>
              </dl>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ClosedPeriod({parcel}: {parcel: FormerParcelDTO}) {
  const t = useTranslations('BureauMemberProfilesPage.detail.parcels')

  return t('period', {
    from: isoToFrenchDate(parcel.startsOn),
    to: isoToFrenchDate(lastOwnershipDayOf(parcel.endsOn)),
  })
}

function Buyer({parcel}: {parcel: FormerParcelDTO}) {
  if (!parcel.soldTo) return null

  return (
    <Link
      href={memberProfilePathOf(parcel.soldTo.memberProfileId)}
      className="underline underline-offset-4"
    >
      {parcel.soldTo.name}
    </Link>
  )
}
