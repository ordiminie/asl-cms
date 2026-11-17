'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {AlertTriangle} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {type ReactNode, useId, useState} from 'react'
import {useForm} from 'react-hook-form'

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
import {Button} from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {RadioGroup, RadioGroupItem} from '@/components/ui/radio-group'
import {joinParcelNumbers} from '@/services/rules/campaign-rules'
import type {MemberEmailRole} from '@/services/types/domain/member-email-types'
import type {
  MemberAccountHolderDTO,
  MemberProfileEmailChange,
  MemberProfileEmailDTO,
} from '@/services/types/domain/member-profile-types'

import {
  createMemberEmailFormSchema,
  MEMBER_EMAIL_FORM_FIELDS,
  type MemberEmailFormSchemaType,
  type MemberProfileEmailActionResult,
  type MemberProfileEmailFormAction,
} from './member-profile-email-validation'
import {CONFIRMED_ACCOUNT_FIELD} from './member-profile-form-validation'

/**
 * Fenetres de la carte « Adresses email » (s54, ecran 4) : ajouter (4b, 4c),
 * gerer — modifier, designer titulaire (4d) — et retirer (4e, 4f). « Annuler »
 * ecrit, pas de croix ; sous 640 px, ancrees en bas, pleine largeur, boutons
 * de 56 px empiles, le principal d'abord.
 */

type Saved = {change: MemberProfileEmailChange; email: string}

const BOTTOM_SHEET =
  'max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none'
const BUTTON_CLASS = 'h-14 w-full text-base sm:h-11 sm:w-auto'
const OUTLINE_DESTRUCTIVE =
  'border-destructive text-destructive-text hover:text-destructive-text'

const strong = (chunks: ReactNode) => <strong>{chunks}</strong>

const isActive = (email: MemberProfileEmailDTO) => email.status === 'active'

const activeHolderOf = (emails: readonly MemberProfileEmailDTO[]) =>
  emails.find((email) => isActive(email) && email.role === 'holder')

const formDataOf = (values: Record<string, string | undefined>): FormData => {
  const formData = new FormData()
  for (const [key, value] of Object.entries(values)) {
    if (value) formData.set(key, value)
  }
  return formData
}

/** Le refus d'ecriture que la fenetre affiche, ou rien. */
const failureOf = (
  result: MemberProfileEmailActionResult,
  t: ReturnType<typeof useTranslations<'BureauMemberProfilesPage'>>
): string | null => {
  if (result.status === 'error') return result.message
  if (result.status === 'board_email_required') {
    return t('detail.emails.removeDialog.boardEmailRequired')
  }
  if (result.status === 'invalid_replacement') {
    return t('detail.emails.manageDialog.invalidDesignation')
  }
  return null
}

function FailureAlert({message}: {message: string | null}) {
  if (!message) return null
  return (
    <Alert variant="destructive" className="border-2">
      <AlertTriangle aria-hidden="true" />
      <AlertDescription className="text-foreground text-base">
        {message}
      </AlertDescription>
    </Alert>
  )
}

/** Un champ email de fenetre : libelle, aide, erreur aux trois signaux. */
function EmailField({
  label,
  help,
  error,
  form,
}: {
  label: string
  help?: string
  error?: string
  form: ReturnType<typeof useForm<MemberEmailFormSchemaType>>
}) {
  const id = useId()
  const describedBy = [help && `${id}-help`, error && `${id}-error`]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-base font-medium">
        {label}
      </Label>
      <Input
        id={id}
        type="email"
        inputMode="email"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className="h-14 text-[18px] aria-invalid:border-2 sm:h-12"
        {...form.register('email')}
      />
      {help && (
        <p id={`${id}-help`} className="text-muted-foreground text-base">
          {help}
        </p>
      )}
      {error && (
        <p
          id={`${id}-error`}
          className="text-destructive-text text-base font-medium"
        >
          {error}
        </p>
      )}
    </div>
  )
}

const useEmailForm = (email = '') => {
  const t = useTranslations('BureauMemberProfilesPage')
  return useForm<MemberEmailFormSchemaType>({
    resolver: zodResolver(createMemberEmailFormSchema(t)),
    defaultValues: {email},
    mode: 'onSubmit',
  })
}

type AddEmailDialogProps = {
  profileId: string
  emails: MemberProfileEmailDTO[]
  open: boolean
  onClose: () => void
  onSaved: (saved: Saved) => void
  action: MemberProfileEmailFormAction
}

/** « Ajouter une adresse » (4b), puis l'adresse deja portee ailleurs (4c). */
export function AddEmailDialog(props: AddEmailDialogProps) {
  const t = useTranslations('BureauMemberProfilesPage.detail.emails.addDialog')

  return (
    <Dialog open={props.open} onOpenChange={(next) => !next && props.onClose()}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className={BOTTOM_SHEET}
      >
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {t('title')}
          </DialogTitle>
        </DialogHeader>
        {props.open && <AddEmailForm {...props} />}
      </DialogContent>
    </Dialog>
  )
}

function AddEmailForm({
  profileId,
  emails,
  onClose,
  onSaved,
  action,
}: AddEmailDialogProps) {
  const t = useTranslations('BureauMemberProfilesPage')
  const form = useEmailForm()
  const [holder, setHolder] = useState<MemberAccountHolderDTO | null>(null)
  const [role, setRole] = useState<MemberEmailRole>('additional')
  const [failure, setFailure] = useState<string | null>(null)
  const firstAddress = !emails.some(isActive)
  const currentHolder = activeHolderOf(emails)

  const send = async (
    values: MemberEmailFormSchemaType,
    confirmed?: MemberAccountHolderDTO
  ) => {
    setFailure(null)
    const result = await action(
      undefined,
      formDataOf({
        [MEMBER_EMAIL_FORM_FIELDS.memberProfileId]: profileId,
        [MEMBER_EMAIL_FORM_FIELDS.email]: values.email.trim(),
        [MEMBER_EMAIL_FORM_FIELDS.role]: confirmed ? role : undefined,
        [CONFIRMED_ACCOUNT_FIELD]: confirmed?.userId,
      })
    )
    if (result.status === 'saved') {
      onSaved(result)
    } else if (result.status === 'email_shared') {
      setHolder(result.holder)
    } else if (result.status === 'invalid') {
      form.setError('email', {message: result.message})
    } else if (result.status === 'already_listed') {
      form.setError('email', {
        message: t('detail.emails.addDialog.alreadyListed'),
      })
    } else {
      setFailure(failureOf(result, t))
    }
  }

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => send(values))}
      className="flex flex-col gap-6"
    >
      <FailureAlert message={failure} />
      <EmailField
        form={form}
        label={t('detail.emails.addDialog.label')}
        help={t(
          firstAddress
            ? 'detail.emails.addDialog.helpFirst'
            : 'detail.emails.addDialog.help'
        )}
        error={form.formState.errors.email?.message}
      />
      {holder ? (
        <SharedEmailChoice
          holder={holder}
          currentHolderEmail={currentHolder?.email ?? null}
          role={role}
          onRole={setRole}
          onConfirm={() =>
            form.handleSubmit((values) => send(values, holder))()
          }
          onDecline={() => {
            setHolder(null)
            setRole('additional')
            form.setFocus('email')
          }}
        />
      ) : (
        <DialogFooter className="flex-col gap-3 sm:flex-row">
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className={BUTTON_CLASS}
          >
            {form.formState.isSubmitting
              ? t('detail.emails.addDialog.submitting')
              : t('detail.emails.addDialog.submit')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className={BUTTON_CLASS}
            onClick={onClose}
          >
            {t('detail.emails.addDialog.cancel')}
          </Button>
        </DialogFooter>
      )}
    </form>
  )
}

/**
 * Encart `warning` de s53 (3a) dans la fenetre, sans pronom, avec le choix du
 * role sur cette fiche (critere 8). Rien n'est ecrit avant « Oui ».
 */
function SharedEmailChoice({
  holder,
  currentHolderEmail,
  role,
  onRole,
  onConfirm,
  onDecline,
}: {
  holder: MemberAccountHolderDTO
  currentHolderEmail: string | null
  role: MemberEmailRole
  onRole: (role: MemberEmailRole) => void
  onConfirm: () => void
  onDecline: () => void
}) {
  const t = useTranslations('BureauMemberProfilesPage')
  const legendId = useId()
  const roleId = useId()

  return (
    <div className="flex flex-col gap-4">
      <Alert className="border-warning-border bg-warning text-warning-foreground border-2 [&>svg]:size-5">
        <AlertTriangle aria-hidden="true" />
        <AlertDescription className="text-warning-foreground gap-2 text-base">
          <p className="font-semibold">
            {t('detail.emails.addDialog.sharedTitle', {name: holder.name})}
          </p>
          <p>
            {t('detail.emails.addDialog.sharedProfiles')}{' '}
            {holder.profiles
              .map((profile) =>
                t('emailShared.profile', {
                  name: profile.name,
                  count: profile.parcelNumbers.length,
                  numbers: joinParcelNumbers(profile.parcelNumbers),
                })
              )
              .join(' · ')}
            . {t('detail.emails.addDialog.sharedQuestion')}
          </p>
        </AlertDescription>
      </Alert>
      {currentHolderEmail && (
        <div className="flex flex-col gap-3">
          <p id={legendId} className="text-base font-medium">
            {t('detail.emails.addDialog.roleLegend')}
          </p>
          <RadioGroup
            aria-labelledby={legendId}
            value={role}
            onValueChange={(value) => onRole(value as MemberEmailRole)}
          >
            <div className="flex items-center gap-3">
              <RadioGroupItem id={`${roleId}-additional`} value="additional" />
              <Label htmlFor={`${roleId}-additional`} className="text-base">
                {t('detail.emails.addDialog.roleAdditional')}
              </Label>
            </div>
            <div className="flex items-start gap-3">
              <RadioGroupItem
                id={`${roleId}-holder`}
                value="holder"
                aria-describedby={`${roleId}-holder-help`}
              />
              <div className="flex flex-col gap-1">
                <Label htmlFor={`${roleId}-holder`} className="text-base">
                  {t('detail.emails.addDialog.roleHolder')}
                </Label>
                <p
                  id={`${roleId}-holder-help`}
                  className="text-muted-foreground text-[15px]"
                >
                  {t('detail.emails.addDialog.roleHolderHelp', {
                    email: currentHolderEmail,
                  })}
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>
      )}
      <DialogFooter className="flex-col gap-3 sm:flex-row">
        <Button type="button" className={BUTTON_CLASS} onClick={onConfirm}>
          {t('detail.emails.addDialog.confirm')}
        </Button>
        <Button
          type="button"
          variant="outline"
          className={BUTTON_CLASS}
          onClick={onDecline}
        >
          {t('detail.emails.addDialog.decline')}
        </Button>
      </DialogFooter>
    </div>
  )
}

type ManageEmailDialogProps = {
  profileId: string
  emails: MemberProfileEmailDTO[]
  /** La position de l'adresse geree, ou rien : la fenetre est fermee. */
  index: number | null
  onClose: () => void
  onSaved: (saved: Saved) => void
  onRemove: (index: number) => void
  updateAction: MemberProfileEmailFormAction
  designateAction: MemberProfileEmailFormAction
}

/** « Gerer » : modifier l'adresse, la designer titulaire, ou la retirer. */
export function ManageEmailDialog(props: ManageEmailDialogProps) {
  const t = useTranslations(
    'BureauMemberProfilesPage.detail.emails.manageDialog'
  )
  const email = props.index === null ? undefined : props.emails[props.index]

  return (
    <Dialog
      open={email !== undefined}
      onOpenChange={(next) => !next && props.onClose()}
    >
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className={BOTTOM_SHEET}
      >
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl break-all">
            {email ? t('title', {email: email.email}) : ''}
          </DialogTitle>
        </DialogHeader>
        {email && props.index !== null && (
          <ManageEmailForm {...props} email={email} index={props.index} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ManageEmailForm({
  profileId,
  emails,
  email,
  index,
  onClose,
  onSaved,
  onRemove,
  updateAction,
  designateAction,
}: ManageEmailDialogProps & {email: MemberProfileEmailDTO; index: number}) {
  const t = useTranslations('BureauMemberProfilesPage')
  const form = useEmailForm(email.email)
  const [designating, setDesignating] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const designatable = isActive(email) && email.role === 'additional'
  const currentHolder = activeHolderOf(emails)

  const handle = (result: MemberProfileEmailActionResult) => {
    if (result.status === 'saved') onSaved(result)
    else if (result.status === 'invalid') {
      form.setError('email', {message: result.message})
    } else if (result.status === 'already_listed') {
      form.setError('email', {
        message: t('detail.emails.addDialog.alreadyListed'),
      })
    } else if (result.status === 'email_shared') {
      form.setError('email', {
        message: t('detail.emails.removeDialog.sharedReplacement'),
      })
    } else setFailure(failureOf(result, t))
  }

  const target = {
    [MEMBER_EMAIL_FORM_FIELDS.memberProfileId]: profileId,
    [MEMBER_EMAIL_FORM_FIELDS.emailId]: email.id,
  }

  if (designating) {
    return (
      <div className="flex flex-col gap-6">
        <FailureAlert message={failure} />
        <p className="text-[17px]">
          {t('detail.emails.manageDialog.designateConfirm', {
            next: email.email,
            previous: currentHolder?.email ?? '',
          })}
        </p>
        <DialogFooter className="flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            className={BUTTON_CLASS}
            onClick={async () => {
              setFailure(null)
              handle(await designateAction(undefined, formDataOf(target)))
            }}
          >
            {t('detail.emails.manageDialog.designate')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className={BUTTON_CLASS}
            onClick={() => setDesignating(false)}
          >
            {t('detail.emails.addDialog.cancel')}
          </Button>
        </DialogFooter>
      </div>
    )
  }

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(async (values) => {
        setFailure(null)
        handle(
          await updateAction(
            undefined,
            formDataOf({
              ...target,
              [MEMBER_EMAIL_FORM_FIELDS.email]: values.email.trim(),
            })
          )
        )
      })}
      className="flex flex-col gap-6"
    >
      <FailureAlert message={failure} />
      <EmailField
        form={form}
        label={t('detail.emails.manageDialog.label')}
        help={
          isActive(email)
            ? undefined
            : t('detail.emails.manageDialog.pendingHelp')
        }
        error={form.formState.errors.email?.message}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
          className={BUTTON_CLASS}
        >
          {form.formState.isSubmitting
            ? t('detail.emails.manageDialog.saving')
            : t('detail.emails.manageDialog.save')}
        </Button>
        {designatable && (
          <Button
            type="button"
            variant="outline"
            className={BUTTON_CLASS}
            onClick={() => setDesignating(true)}
          >
            {t('detail.emails.manageDialog.designate')}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className={`${BUTTON_CLASS} ${OUTLINE_DESTRUCTIVE}`}
          onClick={() => onRemove(index)}
        >
          {t('detail.emails.manageDialog.remove')}
        </Button>
        <Button
          type="button"
          variant="outline"
          className={BUTTON_CLASS}
          onClick={onClose}
        >
          {t('detail.emails.manageDialog.close')}
        </Button>
      </div>
    </form>
  )
}

type RemoveEmailDialogProps = {
  profileId: string
  emails: MemberProfileEmailDTO[]
  index: number | null
  onClose: () => void
  onSaved: (saved: Saved) => void
  action: MemberProfileEmailFormAction
}

/** Choix de la remplacante : une adresse active, par position, ou une saisie. */
const NEW_ADDRESS = 'new'

/**
 * Retirer une adresse (4e, 4f) : `alert-dialog`, l'acces de cette adresse a
 * cette fiche se ferme. La titulaire ne part qu'avec sa remplacante, sauf la
 * derniere adresse active (« Retirer, passer en courrier »).
 */
export function RemoveEmailDialog(props: RemoveEmailDialogProps) {
  const t = useTranslations(
    'BureauMemberProfilesPage.detail.emails.removeDialog'
  )
  const email = props.index === null ? undefined : props.emails[props.index]

  return (
    <AlertDialog
      open={email !== undefined}
      onOpenChange={(next) => !next && props.onClose()}
    >
      <AlertDialogContent className="max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none">
        {email && (
          <RemoveEmailBody
            {...props}
            email={email}
            title={t('title', {email: email.email})}
          />
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}

function RemoveEmailBody({
  profileId,
  emails,
  email,
  title,
  onSaved,
  action,
}: RemoveEmailDialogProps & {email: MemberProfileEmailDTO; title: string}) {
  const t = useTranslations('BureauMemberProfilesPage')
  const [choice, setChoice] = useState<string | null>(null)
  const [replacement, setReplacement] = useState('')
  const [failure, setFailure] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const radioId = useId()
  const newAddressId = useId()
  const isHolder = isActive(email) && email.role === 'holder'
  const others = emails
    .map((other, position) => ({other, position}))
    .filter(({other}) => other.id !== email.id && isActive(other))

  const remove = async (values: Record<string, string | undefined>) => {
    setFailure(null)
    setPending(true)
    const result = await action(
      undefined,
      formDataOf({
        [MEMBER_EMAIL_FORM_FIELDS.memberProfileId]: profileId,
        [MEMBER_EMAIL_FORM_FIELDS.emailId]: email.id,
        ...values,
      })
    )
    setPending(false)
    if (result.status === 'saved') onSaved(result)
    else if (result.status === 'email_shared') {
      setFailure(t('detail.emails.removeDialog.sharedReplacement'))
    } else if (result.status === 'invalid') setFailure(result.message)
    else if (result.status === 'replacement_required') {
      setFailure(t('detail.emails.removeDialog.chooseReplacement'))
    } else setFailure(failureOf(result, t))
  }

  const replaceValues = () =>
    choice === NEW_ADDRESS
      ? {[MEMBER_EMAIL_FORM_FIELDS.replacementEmail]: replacement.trim()}
      : {
          [MEMBER_EMAIL_FORM_FIELDS.replacementEmailId]:
            emails[Number(choice)]?.id,
        }
  const canReplace =
    choice !== null && (choice !== NEW_ADDRESS || replacement.trim() !== '')

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle className="break-all">{title}</AlertDialogTitle>
        <AlertDialogDescription className="text-foreground text-base">
          {isHolder ? (
            <strong>{t('detail.emails.removeDialog.chooseReplacement')}</strong>
          ) : (
            <>
              {t.rich('detail.emails.removeDialog.consequence', {
                email: email.email,
                strong,
              })}
              {email.otherProfiles.length > 0 &&
                ` ${t('detail.emails.removeDialog.othersStay')}`}
            </>
          )}
        </AlertDialogDescription>
      </AlertDialogHeader>

      <FailureAlert message={failure} />

      {isHolder && (
        <div className="flex flex-col gap-4">
          <RadioGroup
            aria-label={t('detail.emails.removeDialog.chooseReplacement')}
            value={choice ?? undefined}
            onValueChange={setChoice}
          >
            {others.map(({other, position}) => (
              <div key={other.email} className="flex items-center gap-3">
                <RadioGroupItem
                  id={`${radioId}-${position}`}
                  value={String(position)}
                />
                <Label
                  htmlFor={`${radioId}-${position}`}
                  className="font-mono text-base break-all"
                >
                  {other.email}
                </Label>
              </div>
            ))}
            <div className="flex items-center gap-3">
              <RadioGroupItem id={`${radioId}-new`} value={NEW_ADDRESS} />
              <Label htmlFor={`${radioId}-new`} className="text-base">
                {t('detail.emails.removeDialog.newAddress')}
              </Label>
            </div>
          </RadioGroup>
          {choice === NEW_ADDRESS && (
            <div className="flex flex-col gap-2">
              <Label htmlFor={newAddressId} className="text-base font-medium">
                {t('detail.emails.removeDialog.newAddressLabel')}
              </Label>
              <Input
                id={newAddressId}
                type="email"
                inputMode="email"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={replacement}
                onChange={(event) => setReplacement(event.target.value)}
                className="h-14 text-[18px] sm:h-12"
              />
            </div>
          )}
          <p className="text-[17px]">
            {t.rich('detail.emails.removeDialog.consequence', {
              email: email.email,
              strong,
            })}
          </p>
          {others.length === 0 && (
            <p className="text-[17px]">
              {t.rich('detail.emails.removeDialog.orMailOnly', {strong})}
            </p>
          )}
        </div>
      )}

      <AlertDialogFooter className="flex-col gap-3 sm:flex-row">
        {isHolder ? (
          <>
            <Button
              type="button"
              className={BUTTON_CLASS}
              disabled={!canReplace || pending}
              onClick={() => remove(replaceValues())}
            >
              {t('detail.emails.removeDialog.replace')}
            </Button>
            {others.length === 0 && (
              <Button
                type="button"
                variant="outline"
                className={`${BUTTON_CLASS} ${OUTLINE_DESTRUCTIVE}`}
                disabled={pending}
                onClick={() => remove({})}
              >
                {t('detail.emails.removeDialog.removeToMailOnly')}
              </Button>
            )}
          </>
        ) : (
          <Button
            type="button"
            variant="destructive"
            className={BUTTON_CLASS}
            disabled={pending}
            onClick={() => remove({})}
          >
            {t('detail.emails.removeDialog.remove')}
          </Button>
        )}
        <AlertDialogCancel className="h-14 sm:h-11">
          {t('detail.emails.removeDialog.cancel')}
        </AlertDialogCancel>
      </AlertDialogFooter>
    </>
  )
}
