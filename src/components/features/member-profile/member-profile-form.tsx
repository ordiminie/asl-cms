'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {AlertTriangle} from 'lucide-react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useTranslations} from 'next-intl'
import {
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import {
  type FieldValues,
  FormProvider,
  useForm,
  type UseFormReturn,
} from 'react-hook-form'

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
import {joinParcelNumbers} from '@/services/rules/campaign-rules'
import type {MemberAccountHolderDTO} from '@/services/types/domain/member-profile-types'

import {
  MemberContactFields,
  MemberFormErrorSummary,
  MemberTextField,
} from './member-contact-fields'
import {
  CONFIRMED_ACCOUNT_FIELD,
  createMemberProfileFormSchema,
  MEMBER_PROFILE_FORM_FIELDS,
  type MemberProfileActionResult,
  type MemberProfileFormSchemaType,
} from './member-profile-form-validation'
import {
  MEMBER_PROFILES_PATH,
  memberProfilePathOf,
  type SaleReturn,
  saleReturnPathOf,
} from './member-profile-paths'

export type MemberProfileFormAction = (
  prevState: MemberProfileActionResult | undefined,
  formData: FormData
) => Promise<MemberProfileActionResult>

type MemberProfileFormProps = {
  saveAction: MemberProfileFormAction
  /**
   * La vente d'ou vient cet ecran, quand l'acquereur n'avait pas encore de
   * fiche : apres l'enregistrement on y revient, l'acquereur preselectionne
   * et la date conservee.
   */
  saleReturn?: SaleReturn
}

const ID_PREFIX = 'member-profile'

const EMPTY_VALUES: MemberProfileFormSchemaType = {
  name: '',
  email: '',
  phone: '',
  homeAddressLine: '',
  homeAddressComplement: '',
  homePostalCode: '',
  homeCity: '',
  landAddressLine: '',
  landAddressComplement: '',
  landPostalCode: '',
  landCity: '',
  companyName: '',
}

/** La fiche creee, avec le temoin qui lui fait dire « Proprietaire enregistre. ». */
export const createdProfilePathOf = (memberProfileId: string): string =>
  `${memberProfilePathOf(memberProfileId)}?cree=1`

/**
 * Ajouter un proprietaire (ecran 2 du design s12) : trois cartes, une seule
 * soumission. Seul le nom est obligatoire ; sans email, la fiche est « courrier
 * uniquement » et aucun compte n'est cree. Les parcelles se rattachent depuis
 * la fiche.
 */
export function MemberProfileForm({
  saveAction,
  saleReturn,
}: MemberProfileFormProps) {
  const t = useTranslations('BureauMemberProfilesPage')
  const router = useRouter()
  const form = useForm<MemberProfileFormSchemaType>({
    resolver: zodResolver(createMemberProfileFormSchema(t)),
    defaultValues: EMPTY_VALUES,
    mode: 'onBlur',
    reValidateMode: 'onChange',
  })
  const [submitted, setSubmitted] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [holder, setHolder] = useState<MemberAccountHolderDTO | null>(null)
  const {isSubmitting} = form.formState
  const savedRef = useRef(false)
  const {reset} = form

  // Next conserve cet ecran monte apres le `router.push` (`<Activity>`) : une
  // fois la fiche enregistree, il se vide quand il est masque, pour revenir
  // vierge. Une saisie refusee ou en cours, elle, reste.
  useLayoutEffect(
    () => () => {
      if (!savedRef.current) return
      savedRef.current = false
      reset()
      setSubmitted(false)
    },
    [reset]
  )

  useCloseOnChange(form, holder !== null, setHolder)

  const save = async (
    values: MemberProfileFormSchemaType,
    confirmedAccountUserId?: string
  ) => {
    setFailure(null)
    setHolder(null)
    const formData = new FormData()
    for (const field of MEMBER_PROFILE_FORM_FIELDS) {
      formData.set(field, values[field])
    }
    if (confirmedAccountUserId) {
      formData.set(CONFIRMED_ACCOUNT_FIELD, confirmedAccountUserId)
    }

    const result = await saveAction(undefined, formData)
    if (result.status === 'invalid') {
      for (const error of result.errors) {
        form.setError(error.field, {message: error.message})
      }
    } else if (result.status === 'email_shared') {
      setHolder(result.holder)
    } else if (result.status === 'error') {
      setFailure(result.message)
    } else if (result.status === 'saved') {
      savedRef.current = true
      router.push(
        saleReturn
          ? saleReturnPathOf({...saleReturn, buyerId: result.memberProfileId})
          : createdProfilePathOf(result.memberProfileId)
      )
    }
  }

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
            <BreadcrumbPage>{t('breadcrumb.new')}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <h1 className="font-serif text-[34px] leading-tight font-semibold">
        {t('form.title')}
      </h1>

      <FormProvider {...form}>
        <form
          noValidate
          onSubmit={(event) => {
            setSubmitted(true)
            return form.handleSubmit((values) => save(values))(event)
          }}
          className="flex flex-col gap-6"
        >
          {submitted && (
            <MemberFormErrorSummary
              idPrefix={ID_PREFIX}
              fields={MEMBER_PROFILE_FORM_FIELDS}
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

          <FormCard title={t('form.identity')}>
            <MemberTextField
              idPrefix={ID_PREFIX}
              name="name"
              autoComplete="off"
              help
            />
          </FormCard>

          <FormCard title={t('form.contact')}>
            <MemberContactFields
              idPrefix={ID_PREFIX}
              afterEmail={
                holder && (
                  <EmailSharedConfirmation
                    holder={holder}
                    onConfirm={() =>
                      form.handleSubmit((values) =>
                        save(values, holder.userId)
                      )()
                    }
                    onDecline={() => {
                      setHolder(null)
                      form.setFocus('email')
                    }}
                  />
                )
              }
            />
          </FormCard>

          <FormCard title={t('form.parcels')}>
            <p className="text-muted-foreground text-[17px]">
              {t('form.parcelsLater')}
            </p>
          </FormCard>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-14 w-full text-base sm:h-12 sm:w-auto"
            >
              {isSubmitting ? t('form.saving') : t('form.save')}
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-14 w-full text-base sm:h-12 sm:w-auto"
            >
              <Link
                href={
                  saleReturn
                    ? saleReturnPathOf(saleReturn)
                    : MEMBER_PROFILES_PATH
                }
              >
                {t('form.cancel')}
              </Link>
            </Button>
          </div>
        </form>
      </FormProvider>
    </div>
  )
}

function FormCard({title, children}: {title: string; children: ReactNode}) {
  const titleId = useId()

  return (
    <section aria-labelledby={titleId}>
      <Card className="gap-5 px-4 py-6 shadow-none sm:px-6">
        <h2 id={titleId} className="font-serif text-2xl font-semibold">
          {title}
        </h2>
        {children}
      </Card>
    </section>
  )
}

/**
 * Referme l'encart de confirmation des qu'une saisie change (s53, etat 3a) :
 * la confirmation ne vaut que pour la saisie qui l'a demandee.
 */
export function useCloseOnChange<Values extends FieldValues>(
  form: UseFormReturn<Values>,
  open: boolean,
  close: (value: null) => void
) {
  const {watch} = form

  useEffect(() => {
    if (!open) return
    const subscription = watch(() => close(null))
    return () => subscription.unsubscribe()
  }, [open, watch, close])
}

/**
 * L'adresse saisie est deja celle d'un compte de l'association (s53, etat
 * 3a) : nommer le compte et ses terrains, et demander s'il s'agit de la meme
 * personne. Rien n'est enregistre tant que le bureau n'a pas confirme.
 */
export function EmailSharedConfirmation({
  holder,
  onConfirm,
  onDecline,
}: {
  holder: MemberAccountHolderDTO
  onConfirm: () => void
  onDecline: () => void
}) {
  const t = useTranslations('BureauMemberProfilesPage.emailShared')

  return (
    <Alert className="border-warning-border bg-warning text-warning-foreground border-2 [&>svg]:size-5">
      <AlertTriangle aria-hidden="true" />
      <AlertDescription className="text-warning-foreground flex flex-col gap-3 text-base">
        <p>
          <strong>{t('title', {name: holder.name})}</strong>
        </p>
        {holder.profiles.length > 0 && (
          <div>
            <p>{t('profiles')}</p>
            <ul className="list-none">
              {holder.profiles.map((profile) => (
                <li key={profile.id}>
                  <Link
                    href={memberProfilePathOf(profile.id)}
                    className="underline underline-offset-4"
                  >
                    {t('profile', {
                      name: profile.name,
                      count: profile.parcelNumbers.length,
                      numbers: joinParcelNumbers(profile.parcelNumbers),
                    })}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p>{t('question')}</p>
        <p>{t('consequence')}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            className="h-14 w-full text-base sm:h-12 sm:w-auto"
            onClick={onConfirm}
          >
            {t('confirm')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-14 w-full text-base sm:h-12 sm:w-auto"
            onClick={onDecline}
          >
            {t('decline')}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
