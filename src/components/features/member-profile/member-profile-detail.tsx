'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {AlertTriangle, CircleCheck, Lock} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {
  type ReactNode,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import {FormProvider, useForm} from 'react-hook-form'

import {MemberInvoicesSection} from '@/components/features/member-invoice/member-invoices-card'
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
import type {MemberUnsubscribeDTO} from '@/services/types/domain/campaign-types'
import {isOwnershipBeforeImport} from '@/services/types/domain/member-import-types'
import type {BoardMemberInvoicesDTO} from '@/services/types/domain/member-invoice-types'
import type {MemberNotesPageDTO} from '@/services/types/domain/member-note-types'
import type {
  MemberProfileAccountDTO,
  MemberProfileDTO,
} from '@/services/types/domain/member-profile-types'
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
import {type MemberNoteActions, MemberNotesCard} from './member-notes-card'
import {IncompleteBadge, MailOnlyBadge} from './member-profile-badges'
import {DetailCard} from './member-profile-detail-card'
import type {MemberProfileEmailActions} from './member-profile-email-validation'
import {MemberProfileEmailsCard} from './member-profile-emails-card'
import {type MemberProfileFormAction} from './member-profile-form'
import {
  type ChangeMemberRoleFormAction,
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
import {MemberRoleCard} from './member-role-card'
import {MemberUnsubscribedMention} from './member-unsubscribed-mention'

type MemberProfileDetailProps = MemberNoteActions &
  MemberProfileEmailActions & {
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
    changeRoleAction: ChangeMemberRoleFormAction
    /** Le fil des notes internes (s24), lu sans etre attendu. */
    notesPromise: Promise<MemberNotesPageDTO | undefined>
    /** Le refus des campagnes (s25), lu a part de la fiche, sans etre attendu. */
    unsubscribePromise: Promise<MemberUnsubscribeDTO | null>
    /**
     * Les factures de la fiche (s19), lues sans etre attendues ; rien pour un
     * compte qui ne gere pas les factures.
     */
    invoicesPromise: Promise<BoardMemberInvoicesDTO | undefined>
    /** Une facture vient d'etre enregistree : le dire une fois (3c). */
    invoiceSaved: boolean
  }

type Notice =
  | {kind: 'created'; account: MemberProfileAccountDTO}
  /** Les coordonnees sont enregistrees ; les adresses ont leur carte (s54). */
  | {kind: 'contactSaved'}
  | {kind: 'attached'; parcel: AttachedParcel}
  | {kind: 'sold'; parcel: FormerParcelDTO}
  /** Le role est enregistre (s14) : la phrase rendue par l'action. */
  | {kind: 'roleSaved'; message: string}

/** Ce que la fiche dit a l'arrivee : une creation, ou une vente enregistree. */
const arrivalNoticeOf = (input: {
  created: boolean
  soldParcelId?: string
  parcels: MemberParcelsDTO
  account: MemberProfileAccountDTO
}): Notice | null => {
  if (input.created) return {kind: 'created', account: input.account}

  const sold = input.parcels.former
    .filter((parcel) => parcel.parcelId === input.soldParcelId)
    .sort((a, b) => b.endsOn.localeCompare(a.endsOn))[0]
  return sold ? {kind: 'sold', parcel: sold} : null
}

type Editing = {focus?: MemberProfileFormField}

const DATA_CLASS = 'font-mono font-medium tabular-nums'

/**
 * Fiche d'un proprietaire (ecran 3 du design s12, ecran A de s12d et s14) :
 * ses coordonnees, modifiables en place, ses adresses email (s54, ecran 4),
 * l'acces a l'espace membre, son role dans l'association, ses parcelles,
 * presentes et passees, et ses factures (s19).
 */
export function MemberProfileDetail({
  profile,
  parcels,
  today,
  created,
  soldParcelId,
  updateContactAction,
  attachParcelAction,
  changeRoleAction,
  notesPromise,
  unsubscribePromise,
  invoicesPromise,
  invoiceSaved,
  addEmailAction,
  updateEmailAction,
  removeEmailAction,
  designateHolderAction,
  ...noteActions
}: MemberProfileDetailProps) {
  const t = useTranslations('BureauMemberProfilesPage')
  const [editing, setEditing] = useState<Editing | null>(null)
  const [attaching, setAttaching] = useState(false)
  const [pageNotice, setPageNotice] = useState<Notice | null>(null)
  const noticeRef = useRef<HTMLDivElement>(null)
  // Next conserve la fiche montee entre deux navigations (`<Activity>`, sans
  // egard aux parametres de recherche) : l'alerte d'arrivee se lit donc dans
  // les props de l'URL courante, jamais dans un etat fige au montage.
  const notice =
    pageNotice ??
    arrivalNoticeOf({created, soldParcelId, parcels, account: profile.account})

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
              onClick={() => setEditing({focus: 'homeAddressLine'})}
            >
              {t('detail.addHomeAddress')}
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
        <Suspense fallback={null}>
          <MemberUnsubscribedMention promise={unsubscribePromise} />
        </Suspense>
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

      <MemberProfileEmailsCard
        profile={profile}
        addEmailAction={addEmailAction}
        updateEmailAction={updateEmailAction}
        removeEmailAction={removeEmailAction}
        designateHolderAction={designateHolderAction}
      />

      <DetailCard title={t('detail.access.title')}>
        <AccessState name={profile.name} account={profile.account} />
      </DetailCard>

      <MemberRoleCard
        profile={profile}
        action={changeRoleAction}
        onSaved={(message) => setPageNotice({kind: 'roleSaved', message})}
      />

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

      <MemberInvoicesSection
        memberProfileId={profile.id}
        memberName={profile.name}
        invoicesPromise={invoicesPromise}
        saved={invoiceSaved}
      />

      <MemberNotesCard
        memberProfileId={profile.id}
        notesPromise={notesPromise}
        today={today}
        {...noteActions}
      />

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

  if (notice.kind === 'roleSaved') {
    return (
      <TitledNotice
        title={t('detail.role.saved.title')}
        detail={notice.message}
      />
    )
  }

  if (notice.kind === 'created') {
    return (
      <TitledNotice
        title={t('detail.created')}
        detail={createdDetailOf(notice.account, name, t)}
      />
    )
  }

  return t('detail.contactSaved')
}

type Translate = ReturnType<typeof useTranslations<'BureauMemberProfilesPage'>>

/** Le nom du compte de la fiche, s'il porte d'autres fiches (s53). */
const sharedAccountOf = (account: MemberProfileAccountDTO): string | null =>
  account.status === 'open' && account.otherProfiles.length > 0
    ? account.accountName
    : null

/** Ce que dit l'arrivee d'une fiche creee : compte ouvert, ou rejoint (3b). */
const createdDetailOf = (
  account: MemberProfileAccountDTO,
  name: string,
  t: Translate
): string | null => {
  if (account.status !== 'open') return null
  const shared = sharedAccountOf(account)
  return shared
    ? t('detail.linkedOnCreate', {account: shared})
    : t('detail.accountOpenedOnCreate', {name, email: account.loginEmail})
}

/** Le titre d'une confirmation, puis ce qui a change de l'acces (s12d). */
function TitledNotice({title, detail}: {title: string; detail: string | null}) {
  if (!detail) return title

  return (
    <>
      <p className="font-semibold">{title}</p>
      <p>{detail}</p>
    </>
  )
}

const strong = (chunks: ReactNode) => <strong>{chunks}</strong>

/**
 * L'etat **enregistre** de l'acces a l'espace membre (s12d), reduit a sa
 * phrase d'ouverture depuis s54 : chaque adresse active se connecte, et son
 * role au bureau comme les autres fiches de son compte s'ecrivent par
 * adresse, dans la carte « Adresses email ».
 */
function AccessState({
  name,
  account,
}: {
  name: string
  account: MemberProfileAccountDTO
}) {
  const t = useTranslations('BureauMemberProfilesPage.detail.access')

  return (
    <div className="flex items-start gap-3">
      <Lock
        aria-hidden="true"
        className="text-primary mt-0.5 size-5 shrink-0"
        strokeWidth={1.75}
      />
      <p className="text-[17px]">
        {account.status === 'open'
          ? t.rich('open', {name, email: account.loginEmail, strong})
          : t.rich('mailOnly', {strong})}
      </p>
    </div>
  )
}

/** Les lignes d'une adresse postale : adresse, complement, code postal et commune. */
const addressLinesOf = (
  line: string | null,
  complement: string | null,
  postalCode: string | null,
  city: string | null
): string[] =>
  [
    line,
    complement,
    [postalCode, city]
      .filter((part): part is string => Boolean(part))
      .join(' '),
  ].filter((part): part is string => Boolean(part))

function Note({children}: {children: ReactNode}) {
  return (
    <span className="text-muted-foreground block text-base">{children}</span>
  )
}

/**
 * Paires libelle / valeur, dans l'ordre du design s55 : telephone, domicile
 * (l'adresse postale), terrain, nom de l'entreprise. Absente = « Non
 * renseignee » / « Non renseigne » / « Aucun ».
 */
function ContactView({
  profile,
  onEdit,
}: {
  profile: MemberProfileDTO
  onEdit: () => void
}) {
  const t = useTranslations('BureauMemberProfilesPage.detail.contact')
  const homeLines = addressLinesOf(
    profile.homeAddressLine,
    profile.homeAddressComplement,
    profile.homePostalCode,
    profile.homeCity
  )
  const landLines = addressLinesOf(
    profile.landAddressLine,
    profile.landAddressComplement,
    profile.landPostalCode,
    profile.landCity
  )

  return (
    <>
      <dl className="grid gap-x-6 gap-y-3 text-[17px] sm:grid-cols-[12rem_1fr]">
        <dt className="text-muted-foreground">{t('phone')}</dt>
        <dd>{profile.phone ?? <Missing>{t('missingMasculine')}</Missing>}</dd>
        <dt className="text-muted-foreground">{t('homeAddress')}</dt>
        <dd>
          {homeLines.length === 0 ? (
            <Missing>{t('missingFeminine')}</Missing>
          ) : (
            <>
              {homeLines.map((line) => (
                <div key={line}>{line}</div>
              ))}
              <Note>{t('homeAddressNote')}</Note>
            </>
          )}
        </dd>
        <dt className="text-muted-foreground">{t('landAddress')}</dt>
        <dd>
          {landLines.length === 0 ? (
            <Missing>{t('missingFeminine')}</Missing>
          ) : (
            landLines.map((line) => <div key={line}>{line}</div>)
          )}
        </dd>
        <dt className="text-muted-foreground">{t('companyName')}</dt>
        <dd>
          {profile.companyName ? (
            <>
              <div>{profile.companyName}</div>
              <Note>{t('companyNameNote')}</Note>
            </>
          ) : (
            <Missing>{t('missingCompany')}</Missing>
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

/**
 * Les coordonnees, modifiees en place (etat `3e`, critere 6) : telephone,
 * domicile, terrain et nom de l'entreprise (s55). Les adresses email ont leur
 * carte (s54).
 */
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
      phone: profile.phone ?? '',
      homeAddressLine: profile.homeAddressLine ?? '',
      homeAddressComplement: profile.homeAddressComplement ?? '',
      homePostalCode: profile.homePostalCode ?? '',
      homeCity: profile.homeCity ?? '',
      landAddressLine: profile.landAddressLine ?? '',
      landAddressComplement: profile.landAddressComplement ?? '',
      landPostalCode: profile.landPostalCode ?? '',
      landCity: profile.landCity ?? '',
      companyName: profile.companyName ?? '',
    },
    mode: 'onBlur',
    reValidateMode: 'onChange',
  })
  const {setFocus} = form
  const [submitted, setSubmitted] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  useEffect(() => {
    if (focus && focus !== 'name' && focus !== 'email') setFocus(focus)
  }, [focus, setFocus])

  const save = async (values: MemberContactFormSchemaType) => {
    setFailure(null)
    const formData = new FormData()
    formData.set('memberProfileId', profile.id)
    for (const field of MEMBER_CONTACT_FORM_FIELDS) {
      formData.set(field, values[field])
    }

    const result = await action(undefined, formData)
    if (result.status === 'invalid') {
      for (const error of result.errors) {
        if (error.field !== 'name' && error.field !== 'email') {
          form.setError(error.field, {message: error.message})
        }
      }
    } else if (result.status === 'error') {
      setFailure(result.message)
    } else if (result.status === 'saved') {
      onSaved()
    }
  }

  return (
    <FormProvider {...form}>
      <form
        noValidate
        onSubmit={(event) => {
          setSubmitted(true)
          return form.handleSubmit(save)(event)
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
        <MemberContactFields idPrefix={CONTACT_ID_PREFIX} withEmail={false} />
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
                      <OwnershipStart startsOn={parcel.startsOn} />
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
                      <OwnershipStart startsOn={parcel.startsOn} />
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
  const to = isoToFrenchDate(lastOwnershipDayOf(parcel.endsOn))

  return isOwnershipBeforeImport(parcel.startsOn)
    ? t('periodBeforeImport', {to})
    : t('period', {from: isoToFrenchDate(parcel.startsOn), to})
}

/**
 * Debut de propriete : la date, ou « avant l'import » pour la date sentinelle
 * des parcelles importees (s13), qui ne s'affiche jamais comme une date.
 */
function OwnershipStart({startsOn}: {startsOn: string}) {
  const t = useTranslations('BureauMemberProfilesPage.detail.parcels')

  return isOwnershipBeforeImport(startsOn)
    ? t('beforeImport')
    : isoToFrenchDate(startsOn)
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
