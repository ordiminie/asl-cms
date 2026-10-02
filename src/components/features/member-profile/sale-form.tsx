'use client'

import {AlertTriangle} from 'lucide-react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useTranslations} from 'next-intl'
import {type ReactNode, useEffect, useId, useState} from 'react'

import {useIsMobile} from '@/components/hooks/use-mobile'
import {Alert, AlertDescription} from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {Button} from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  DateField,
  frenchDateToIso,
  isoToFrenchDate,
} from '@/components/ui/date-field'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  lastOwnershipDayOf,
  planSale,
} from '@/services/rules/parcel-ownership-rules'
import type {
  OwnershipConflictDTO,
  SaleContextDTO,
  SalePlan,
} from '@/services/types/domain/parcel-ownership-types'

import {
  MEMBER_PROFILES_PATH,
  memberProfilePathOf,
  newBuyerPathOf,
  soldParcelPathOf,
} from './member-profile-paths'
import type {
  BuyerOption,
  RecordSaleActionResult,
  SaleFormField,
} from './sale-form-validation'

type SaleFormProps = {
  context: SaleContextDTO
  /** Le jour calendaire de Paris, ISO : la date proposee. */
  today: string
  /** Date ISO conservee au retour de la creation de l'acquereur. */
  initialDate?: string
  /** Acquereur preselectionne au retour de sa creation. */
  initialBuyer?: BuyerOption
  recordSaleAction: (
    prevState: RecordSaleActionResult | undefined,
    formData: FormData
  ) => Promise<RecordSaleActionResult>
  searchBuyersAction: (query: string) => Promise<BuyerOption[]>
}

type FieldErrors = Partial<Record<SaleFormField, string>>

type Refusal =
  | {kind: 'overlap'; conflict: OwnershipConflictDTO | null; date: string}
  | {kind: 'message'; message: string}

const DATE_ID = 'sale-date'
const SEARCH_DELAY_MS = 200

/**
 * Enregistrer une vente (ecran 5 du design s12) : une page, pas un `dialog`.
 * L'encart « Ce qui va changer » suit la saisie, calcule par la meme regle
 * pure que le service (`planSale`), et l'`alert-dialog` le reprend mot pour
 * mot avant l'envoi. Un refus s'affiche sans rien envoyer ; le serveur rejoue
 * les memes controles sous verrou.
 */
export function SaleForm({
  context,
  today,
  initialDate,
  initialBuyer,
  recordSaleAction,
  searchBuyersAction,
}: SaleFormProps) {
  const t = useTranslations('BureauMemberProfilesPage')
  const router = useRouter()
  const [date, setDate] = useState(isoToFrenchDate(initialDate ?? today))
  const [buyer, setBuyer] = useState<BuyerOption | null>(initialBuyer ?? null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [refusal, setRefusal] = useState<Refusal | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [isPending, setIsPending] = useState(false)

  const {seller, parcelNumber, parcelId} = context
  const sellerPath = memberProfilePathOf(seller.memberProfileId)
  const isoDate = frenchDateToIso(date)
  const sellerPeriod = context.periods.find(
    (period) =>
      period.memberProfileId === seller.memberProfileId &&
      period.endsOn === null
  )
  const sellerStart = sellerPeriod?.startsOn ?? ''

  const refusalOf = (
    result: Exclude<
      RecordSaleActionResult,
      {status: 'recorded'} | {status: 'invalid'}
    >,
    saleDate: string
  ): {errors?: FieldErrors; refusal?: Refusal} => {
    switch (result.status) {
      case 'date_not_after_start':
        return {
          errors: {
            date: t('sale.refusals.dateNotAfterStart', {
              name: seller.name,
              date: isoToFrenchDate(result.startsOn),
            }),
          },
        }
      case 'buyer_is_seller':
        return {
          errors: {
            buyerId: t('sale.refusals.buyerIsSeller', {name: seller.name}),
          },
        }
      case 'no_open_period':
        return {
          refusal: {
            kind: 'message',
            message: t('sale.refusals.noOpenPeriod', {
              name: seller.name,
              number: parcelNumber,
            }),
          },
        }
      case 'overlap':
        return {
          refusal: {kind: 'overlap', conflict: result.conflict, date: saleDate},
        }
      default:
        return {refusal: {kind: 'message', message: result.message}}
    }
  }

  /** Le refus de la regle pure, sous la forme que rend aussi le serveur. */
  const toRefusedResult = (
    plan: Extract<SalePlan, {ok: false}>
  ): Exclude<
    RecordSaleActionResult,
    {status: 'recorded'} | {status: 'invalid'}
  > => {
    if (plan.reason === 'date_not_after_start') {
      return {status: plan.reason, startsOn: sellerStart}
    }
    if (plan.reason !== 'overlap') return {status: plan.reason}

    const period = context.periods.find(
      (candidate) => candidate.id === plan.conflict?.id
    )
    return {
      status: 'overlap',
      conflict: period
        ? {
            memberProfileId: period.memberProfileId,
            name: period.memberName,
            startsOn: period.startsOn,
            endsOn: period.endsOn,
          }
        : null,
    }
  }

  const show = (outcome: {errors?: FieldErrors; refusal?: Refusal}) => {
    setErrors(outcome.errors ?? {})
    setRefusal(outcome.refusal ?? null)
  }

  /** Les memes controles que le service, avant d'ouvrir la confirmation. */
  const onSubmit = () => {
    const missing: FieldErrors = {
      ...(isoDate ? {} : {date: t('validation.dateInvalid')}),
      ...(buyer ? {} : {buyerId: t('validation.buyerRequired')}),
    }
    if (!isoDate || !buyer) {
      show({errors: missing})
      return
    }

    const plan = planSale({
      periods: context.periods,
      sellerId: seller.memberProfileId,
      buyerId: buyer.id,
      date: isoDate,
    })
    if (!plan.ok) {
      show(refusalOf(toRefusedResult(plan), isoDate))
      return
    }

    show({})
    setConfirming(true)
  }

  const onConfirm = async () => {
    if (!isoDate || !buyer) return

    setIsPending(true)
    const formData = new FormData()
    formData.set('sellerId', seller.memberProfileId)
    formData.set('parcelId', parcelId)
    formData.set('buyerId', buyer.id)
    formData.set('date', date)

    const result = await recordSaleAction(undefined, formData)
    setIsPending(false)
    setConfirming(false)

    if (result.status === 'recorded') {
      router.push(soldParcelPathOf(seller.memberProfileId, parcelId))
    } else if (result.status === 'invalid') {
      show({
        errors: Object.fromEntries(
          result.errors.map((error) => [error.field, error.message])
        ),
      })
    } else {
      show(refusalOf(result, isoDate))
    }
  }

  const changes = (
    <SaleChanges
      sellerName={seller.name}
      sellerStart={sellerStart}
      buyerName={buyer?.name}
      date={isoDate && isoDate > sellerStart ? isoDate : undefined}
    />
  )

  return (
    <div className="mx-auto flex w-full max-w-190 flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <Breadcrumb aria-label={t('breadcrumb.label')}>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={MEMBER_PROFILES_PATH}>{t('breadcrumb.list')}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={sellerPath}>{seller.name}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>
              {t('sale.breadcrumb', {number: parcelNumber})}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <h1 className="font-serif text-[34px] leading-tight font-semibold">
        {t('sale.title', {number: parcelNumber})}
      </h1>

      {refusal && (
        <RefusalAlert refusal={refusal} parcelNumber={parcelNumber} />
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor={DATE_ID} className="text-base font-medium">
          {t('sale.date.label')}
        </Label>
        <p id={`${DATE_ID}-help`} className="text-muted-foreground text-base">
          {t('sale.date.help')}
        </p>
        <DateField
          id={DATE_ID}
          value={date}
          onValueChange={setDate}
          placeholder={t('sale.date.format')}
          aria-describedby={`${DATE_ID}-help`}
          error={errors.date}
        />
      </div>

      <div className="flex flex-col gap-2">
        <BuyerPicker
          buyer={buyer}
          error={errors.buyerId}
          onChoose={setBuyer}
          searchBuyersAction={searchBuyersAction}
        />
        <p className="text-base">
          {t('sale.noProfileYet')}{' '}
          <Link
            href={newBuyerPathOf({
              sellerId: seller.memberProfileId,
              parcelId,
              date: isoDate,
            })}
            className="underline underline-offset-4"
          >
            {t('sale.addFirst')}
          </Link>
        </p>
      </div>

      <ChangesPanel>{changes}</ChangesPanel>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          className="h-14 w-full text-base sm:h-12 sm:w-auto"
          onClick={onSubmit}
        >
          {t('sale.submit')}
        </Button>
        <Button
          asChild
          variant="outline"
          className="h-14 w-full text-base sm:h-12 sm:w-auto"
        >
          <Link href={sellerPath}>{t('sale.cancel')}</Link>
        </Button>
      </div>

      <AlertDialog
        open={confirming}
        onOpenChange={(open) => !open && setConfirming(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('sale.confirmTitle', {number: parcelNumber})}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-foreground text-base">{changes}</div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-14 sm:h-11">
              {t('sale.cancel')}
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={isPending}
              className="h-14 sm:h-11"
              onClick={onConfirm}
            >
              {isPending ? t('sale.submitting') : t('sale.submit')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/**
 * « Ce qui va changer », ecrit : la periode du vendeur close a **la veille**
 * de la vente, celle de l'acquereur ouverte le jour meme. Le meme composant
 * sert l'encart et l'`alert-dialog` : leur texte ne peut pas diverger.
 */
function SaleChanges({
  sellerName,
  sellerStart,
  buyerName,
  date,
}: {
  sellerName: string
  sellerStart: string
  buyerName?: string
  /** Date ISO de la vente, quand elle est valide et posterieure au debut. */
  date?: string
}) {
  const t = useTranslations('BureauMemberProfilesPage.sale.changes')
  const from = isoToFrenchDate(sellerStart)

  if (!date) {
    return (
      <div data-slot="sale-changes" className="flex flex-col gap-2">
        <p>{t('sellerPending', {name: sellerName, from})}</p>
      </div>
    )
  }

  const saleDay = isoToFrenchDate(date)

  return (
    <div data-slot="sale-changes" className="flex flex-col gap-2">
      <p>
        {t('seller', {
          name: sellerName,
          from,
          to: isoToFrenchDate(lastOwnershipDayOf(date)),
        })}
      </p>
      {buyerName ? (
        <>
          <p>{t('buyer', {name: buyerName, date: saleDay})}</p>
          <p>{t('history', {date: saleDay, name: sellerName})}</p>
        </>
      ) : (
        <p className="text-muted-foreground">{t('buyerPending')}</p>
      )}
    </div>
  )
}

function ChangesPanel({children}: {children: ReactNode}) {
  const t = useTranslations('BureauMemberProfilesPage.sale.changes')
  const titleId = useId()

  return (
    <section
      aria-labelledby={titleId}
      className="bg-muted flex flex-col gap-3 rounded-md px-4 py-4 text-[17px]"
    >
      <h2 id={titleId} className="text-lg font-semibold">
        {t('title')}
      </h2>
      {children}
    </section>
  )
}

/** Refus ancre en tete (etat `5g`) : ce qui s'est passe, et ou aller voir. */
function RefusalAlert({
  refusal,
  parcelNumber,
}: {
  refusal: Refusal
  parcelNumber: string
}) {
  const t = useTranslations('BureauMemberProfilesPage')
  const conflict = refusal.kind === 'overlap' ? refusal.conflict : null

  return (
    <Alert
      variant="destructive"
      className="border-destructive border-2 [&>svg]:size-5"
    >
      <AlertTriangle aria-hidden="true" />
      <AlertDescription className="text-foreground text-base">
        {refusal.kind === 'message' && <p>{refusal.message}</p>}
        {refusal.kind === 'overlap' && !conflict?.name && (
          <p>{t('sale.refusals.overlapUnknown', {number: parcelNumber})}</p>
        )}
        {refusal.kind === 'overlap' && conflict?.name && (
          <>
            <p>
              {t('sale.refusals.overlap', {
                number: parcelNumber,
                from: isoToFrenchDate(conflict.startsOn),
                name: conflict.name,
                date: isoToFrenchDate(refusal.date),
              })}
            </p>
            <Link
              href={memberProfilePathOf(conflict.memberProfileId)}
              className="underline underline-offset-4"
            >
              {t('openProfileOf', {name: conflict.name})}
            </Link>
          </>
        )}
      </AlertDescription>
    </Alert>
  )
}

/**
 * Choix de l'acquereur : un `command` dans un `popover`, ou dans un `sheet`
 * de bas d'ecran en mobile. Le champ de recherche est ecrit, sans loupe ; le
 * `sheet` se ferme par « Annuler ».
 */
function BuyerPicker({
  buyer,
  error,
  onChoose,
  searchBuyersAction,
}: {
  buyer: BuyerOption | null
  error?: string
  onChoose: (buyer: BuyerOption) => void
  searchBuyersAction: (query: string) => Promise<BuyerOption[]>
}) {
  const t = useTranslations('BureauMemberProfilesPage.sale.buyer')
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const labelId = useId()
  const valueId = useId()
  const errorId = useId()

  const choose = (option: BuyerOption) => {
    onChoose(option)
    setOpen(false)
  }

  const trigger = (
    <Button
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={open}
      aria-labelledby={`${labelId} ${valueId}`}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      className="h-14 w-full justify-start text-left text-[18px] font-normal aria-invalid:border-2 sm:h-12 sm:max-w-md"
      onClick={isMobile ? () => setOpen(true) : undefined}
    >
      <span
        id={valueId}
        className={buyer ? undefined : 'text-muted-foreground'}
      >
        {buyer ? buyer.name : t('choose')}
      </span>
    </Button>
  )

  const search = <BuyerSearch onChoose={choose} action={searchBuyersAction} />

  return (
    <>
      <span id={labelId} className="text-base font-medium">
        {t('label')}
      </span>
      {isMobile ? (
        <>
          {trigger}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetContent
              side="bottom"
              aria-describedby={undefined}
              className="gap-4 px-4 pb-6 [&>button]:hidden"
            >
              <SheetHeader className="px-0">
                <SheetTitle className="font-serif text-2xl">
                  {t('sheetTitle')}
                </SheetTitle>
              </SheetHeader>
              {search}
              <div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-14 w-full text-base"
                  onClick={() => setOpen(false)}
                >
                  {t('cancel')}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent align="start" className="w-[min(28rem,90vw)] p-3">
            {search}
          </PopoverContent>
        </Popover>
      )}
      {error && (
        <p id={errorId} className="text-destructive-text text-base font-medium">
          {error}
        </p>
      )}
    </>
  )
}

type SearchState =
  | {status: 'idle'}
  | {status: 'done'; options: BuyerOption[]}
  | {status: 'failed'}

function BuyerSearch({
  onChoose,
  action,
}: {
  onChoose: (buyer: BuyerOption) => void
  action: (query: string) => Promise<BuyerOption[]>
}) {
  const t = useTranslations('BureauMemberProfilesPage.sale.buyer')
  const inputId = useId()
  const [query, setQuery] = useState('')
  const [state, setState] = useState<SearchState>({status: 'idle'})

  useEffect(() => {
    if (!query.trim()) return

    let cancelled = false
    const runSearch = async () => {
      try {
        const options = await action(query)
        if (!cancelled) setState({status: 'done', options})
      } catch {
        if (!cancelled) setState({status: 'failed'})
      }
    }
    const timer = setTimeout(() => {
      void runSearch()
    }, SEARCH_DELAY_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, action])

  const options = query.trim() && state.status === 'done' ? state.options : []

  return (
    <Command shouldFilter={false} className="gap-3 bg-transparent">
      <div className="flex flex-col gap-2">
        <Label htmlFor={inputId} className="text-base font-medium">
          {t('searchLabel')}
        </Label>
        <Input
          id={inputId}
          autoComplete="off"
          autoFocus
          value={query}
          className="h-14 text-[18px] sm:h-12"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <CommandList>
        {!query.trim() && (
          <p className="text-muted-foreground px-2 py-3 text-base">
            {t('hint')}
          </p>
        )}
        {query.trim() && state.status === 'failed' && (
          <p className="text-destructive-text px-2 py-3 text-base font-medium">
            {t('searchFailed')}
          </p>
        )}
        {query.trim() && state.status === 'done' && (
          <CommandEmpty className="px-2 py-3 text-left text-base">
            {t('noResult')}
          </CommandEmpty>
        )}
        {options.length > 0 && (
          <CommandGroup className="p-0">
            {options.map((option) => (
              <CommandItem
                key={option.id}
                value={option.id}
                className="min-h-14 flex-col items-start gap-0 px-2 py-2 text-[17px]"
                onSelect={() => onChoose(option)}
              >
                <span className="font-semibold">{option.name}</span>
                <span className="text-muted-foreground text-[15px]">
                  {option.currentParcelNumbers.length === 0
                    ? t('noParcel')
                    : t('parcels', {
                        count: option.currentParcelNumbers.length,
                        numbers: option.currentParcelNumbers.join(', '),
                      })}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  )
}
