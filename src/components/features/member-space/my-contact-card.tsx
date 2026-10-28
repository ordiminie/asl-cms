'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {AlertTriangle, CircleCheck} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {type ReactNode, useEffect, useId, useRef, useState} from 'react'
import {FormProvider, useForm} from 'react-hook-form'

import {
  memberFieldIdOf,
  MemberTextField,
} from '@/components/features/member-profile/member-contact-fields'
import {
  createMemberPostalContactFormSchema,
  MEMBER_POSTAL_CONTACT_FORM_FIELDS,
  type MemberPostalContactFormSchemaType,
  type MyContactFormAction,
} from '@/components/features/member-profile/member-profile-form-validation'
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
import {cn} from '@/lib/utils'
import type {MyContactDTO} from '@/services/types/domain/member-space-types'

/**
 * « Mes coordonnees » (s16, ecran C) : lecture, puis modification en place.
 * L'adresse email reste un texte, jamais un champ (ADR 040). Aucun
 * identifiant de fiche n'est rendu ni envoye : l'action resout la fiche par
 * la session.
 */

const ID_PREFIX = 'my-contact'

const BUTTON_CLASS = 'h-14 w-full text-base sm:h-12 sm:w-auto'

type Notice = 'failed' | null

export function MyContactCard({
  contact: initialContact,
  action,
}: {
  contact: MyContactDTO
  action: MyContactFormAction
}) {
  const t = useTranslations('MemberSpacePage.contact')
  const titleId = useId()
  const [contact, setContact] = useState(initialContact)
  const [editing, setEditing] = useState(false)
  const [savedNotice, setSavedNotice] = useState(false)
  const statusRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (savedNotice) statusRef.current?.focus()
  }, [savedNotice])

  return (
    <section aria-labelledby={titleId}>
      <Card className="gap-6 px-4 py-6 shadow-none sm:px-6">
        <h2 id={titleId} className="font-serif text-xl font-semibold">
          {t('title')}
        </h2>
        {savedNotice && !editing && (
          <Alert
            ref={statusRef}
            role="status"
            tabIndex={-1}
            className="[&>svg]:size-5"
          >
            <CircleCheck aria-hidden="true" className="text-primary" />
            <AlertDescription className="text-foreground text-base">
              <p className="font-semibold">{t('saved.title')}</p>
              <p>{t('saved.detail')}</p>
            </AlertDescription>
          </Alert>
        )}
        <EmailReading email={contact.email} />
        {editing ? (
          <ContactEditor
            contact={contact}
            action={action}
            onCancel={() => setEditing(false)}
            onSaved={(saved) => {
              setContact(saved)
              setEditing(false)
              setSavedNotice(true)
            }}
          />
        ) : (
          <>
            <ContactReading contact={contact} />
            <Button
              type="button"
              variant="outline"
              className={BUTTON_CLASS}
              onClick={() => {
                setSavedNotice(false)
                setEditing(true)
              }}
            >
              {t('edit')}
            </Button>
          </>
        )}
      </Card>
    </section>
  )
}

function Pair({term, children}: {term: string; children: ReactNode}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground text-base font-medium">{term}</dt>
      <dd className="text-[17px]">{children}</dd>
    </div>
  )
}

function Missing({children}: {children: ReactNode}) {
  return <span className="text-muted-foreground">{children}</span>
}

/** L'adresse de connexion : un texte, et comment la faire changer. */
function EmailReading({email}: {email: string | null}) {
  const t = useTranslations('MemberSpacePage.contact')

  return (
    <dl>
      <Pair term={t('email')}>
        {email ? (
          <span className="font-mono text-[17px] font-medium [overflow-wrap:anywhere]">
            {email}
          </span>
        ) : (
          <Missing>{t('addressMissing')}</Missing>
        )}
        <p className="text-muted-foreground mt-1 text-[15px]">
          {t('emailNote')}{' '}
          <Link
            href="/contact"
            className="text-primary font-semibold underline underline-offset-4"
          >
            {t('contact')}
          </Link>
        </p>
      </Pair>
    </dl>
  )
}

const postalLinesOf = (contact: MyContactDTO): string[] =>
  [
    contact.addressLine,
    contact.addressComplement,
    [contact.postalCode, contact.city].filter(Boolean).join(' '),
  ].filter((line): line is string => Boolean(line))

function ContactReading({contact}: {contact: MyContactDTO}) {
  const t = useTranslations('MemberSpacePage.contact')
  const postalLines = postalLinesOf(contact)

  return (
    <dl className="flex flex-col gap-6">
      <Pair term={t('phone')}>
        {contact.phone ?? <Missing>{t('phoneMissing')}</Missing>}
      </Pair>
      <Pair term={t('address')}>
        {postalLines.length === 0 ? (
          <Missing>{t('addressMissing')}</Missing>
        ) : (
          postalLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))
        )}
      </Pair>
    </dl>
  )
}

const formValuesOf = (
  contact: MyContactDTO
): MemberPostalContactFormSchemaType => ({
  phone: contact.phone ?? '',
  addressLine: contact.addressLine ?? '',
  addressComplement: contact.addressComplement ?? '',
  postalCode: contact.postalCode ?? '',
  city: contact.city ?? '',
})

function ContactEditor({
  contact,
  action,
  onCancel,
  onSaved,
}: {
  contact: MyContactDTO
  action: MyContactFormAction
  onCancel: () => void
  onSaved: (contact: MyContactDTO) => void
}) {
  const t = useTranslations('MemberSpacePage.contact')
  const tFields = useTranslations('BureauMemberProfilesPage')
  const form = useForm<MemberPostalContactFormSchemaType>({
    resolver: zodResolver(createMemberPostalContactFormSchema(tFields)),
    defaultValues: formValuesOf(contact),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    shouldFocusError: false,
  })
  const [notice, setNotice] = useState<Notice>(null)
  const [focusRequest, setFocusRequest] = useState(0)
  const alertRef = useRef<HTMLDivElement>(null)
  const saving = form.formState.isSubmitting

  useEffect(() => {
    if (focusRequest > 0) alertRef.current?.focus()
  }, [focusRequest])

  const showFailure = (kind: Notice) => {
    setNotice(kind)
    setFocusRequest((count) => count + 1)
  }

  const onValid = async (values: MemberPostalContactFormSchemaType) => {
    setNotice(null)
    const formData = new FormData()
    for (const field of MEMBER_POSTAL_CONTACT_FORM_FIELDS) {
      formData.set(field, values[field])
    }

    const result = await action(undefined, formData)
    if (result.status === 'saved') {
      onSaved(result.contact)
      return
    }
    if (result.status === 'invalid') {
      for (const error of result.errors) {
        form.setError(error.field, {message: error.message})
      }
      showFailure(null)
      return
    }
    showFailure('failed')
  }

  const invalidFields = MEMBER_POSTAL_CONTACT_FORM_FIELDS.filter(
    (field) => form.formState.errors[field]
  )

  return (
    <FormProvider {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(onValid, () => showFailure(null))}
        className="flex flex-col gap-6"
      >
        {notice === 'failed' ? (
          <Alert
            ref={alertRef}
            tabIndex={-1}
            variant="destructive"
            className="border-destructive border-2 [&>svg]:size-5"
          >
            <AlertTriangle aria-hidden="true" />
            <AlertTitle className="text-destructive-text line-clamp-none text-base font-bold">
              {t('failed.title')}
            </AlertTitle>
            <AlertDescription className="text-foreground text-base">
              {t('failed.detail')}
            </AlertDescription>
          </Alert>
        ) : (
          focusRequest > 0 &&
          invalidFields.length > 0 && (
            <Alert
              ref={alertRef}
              tabIndex={-1}
              variant="destructive"
              className="border-destructive border-2 [&>svg]:size-5"
            >
              <AlertTriangle aria-hidden="true" />
              <AlertTitle className="text-destructive-text line-clamp-none text-base font-bold">
                {t('invalid')}
              </AlertTitle>
              <AlertDescription className="text-foreground text-base">
                <ul className="flex list-disc flex-col gap-1 pl-5">
                  {invalidFields.map((field) => (
                    <li key={field}>
                      <a
                        href={`#${memberFieldIdOf(ID_PREFIX, field)}`}
                        className="underline underline-offset-4"
                      >
                        {tFields(`fields.${field}.label`)}
                      </a>
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )
        )}
        <MemberTextField
          idPrefix={ID_PREFIX}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          optional
          className="sm:max-w-xs"
        />
        <MemberTextField
          idPrefix={ID_PREFIX}
          name="addressLine"
          autoComplete="address-line1"
          optional
        />
        <MemberTextField
          idPrefix={ID_PREFIX}
          name="addressComplement"
          autoComplete="address-line2"
          optional
        />
        <div className="grid gap-6 sm:grid-cols-[10rem_1fr]">
          <MemberTextField
            idPrefix={ID_PREFIX}
            name="postalCode"
            inputMode="numeric"
            autoComplete="postal-code"
            optional
            className="font-mono font-medium tabular-nums"
          />
          <MemberTextField
            idPrefix={ID_PREFIX}
            name="city"
            autoComplete="address-level2"
            optional
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" disabled={saving} className={BUTTON_CLASS}>
            <span className="grid">
              <span
                aria-hidden={saving}
                className={cn('col-start-1 row-start-1', saving && 'invisible')}
              >
                {t('save')}
              </span>
              <span
                aria-hidden={!saving}
                className={cn(
                  'col-start-1 row-start-1',
                  !saving && 'invisible'
                )}
              >
                {t('saving')}
              </span>
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className={BUTTON_CLASS}
            onClick={onCancel}
          >
            {t('cancel')}
          </Button>
        </div>
      </form>
    </FormProvider>
  )
}
