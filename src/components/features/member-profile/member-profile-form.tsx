'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {AlertTriangle} from 'lucide-react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useTranslations} from 'next-intl'
import {type ReactNode, useId, useState} from 'react'
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

import {
  MemberContactFields,
  MemberFormErrorSummary,
  MemberTextField,
} from './member-contact-fields'
import {
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
  addressLine: '',
  addressComplement: '',
  postalCode: '',
  city: '',
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
  const [holder, setHolder] = useState<{id: string; name: string} | null>(null)
  const {isSubmitting} = form.formState

  const onValid = async (values: MemberProfileFormSchemaType) => {
    setFailure(null)
    setHolder(null)
    const formData = new FormData()
    for (const field of MEMBER_PROFILE_FORM_FIELDS) {
      formData.set(field, values[field])
    }

    const result = await saveAction(undefined, formData)
    if (result.status === 'invalid') {
      for (const error of result.errors) {
        form.setError(error.field, {message: error.message})
      }
    } else if (result.status === 'email_taken') {
      setHolder({id: result.memberProfileId, name: result.name})
    } else if (result.status === 'error') {
      setFailure(result.message)
    } else {
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
            return form.handleSubmit(onValid)(event)
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
                  <EmailHolder memberProfileId={holder.id} name={holder.name} />
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

/** L'email est deja celui d'une autre fiche : la nommer, et y mener (`2e`). */
export function EmailHolder({
  memberProfileId,
  name,
}: {
  memberProfileId: string
  name: string
}) {
  const t = useTranslations('BureauMemberProfilesPage')

  return (
    <p className="text-destructive-text text-base font-medium">
      {t('emailTaken', {name})}{' '}
      <Link
        href={memberProfilePathOf(memberProfileId)}
        className="underline underline-offset-4"
      >
        {t('openProfileOf', {name})}
      </Link>
    </p>
  )
}
