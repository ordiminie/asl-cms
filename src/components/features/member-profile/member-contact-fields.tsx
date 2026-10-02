'use client'

import {AlertTriangle} from 'lucide-react'
import {useTranslations} from 'next-intl'
import type {ComponentProps, ReactNode} from 'react'
import {useFormContext, useWatch} from 'react-hook-form'

import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {cn} from '@/lib/utils'

import type {MemberProfileFormField} from './member-profile-form-validation'

/** L'identifiant d'un champ : stable, pour que le resume d'erreurs y mene. */
export const memberFieldIdOf = (idPrefix: string, field: string): string =>
  `${idPrefix}-${field}`

type MemberTextFieldProps = Omit<ComponentProps<'input'>, 'name' | 'id'> & {
  idPrefix: string
  name: MemberProfileFormField
  optional?: boolean
  help?: boolean
  after?: ReactNode
}

/**
 * Un champ texte d'une fiche : libelle, « Facultatif » ecrit, aide, puis
 * l'erreur aux trois signaux (bordure 2 px, message sous le champ, resume).
 */
export function MemberTextField({
  idPrefix,
  name,
  optional = false,
  help = false,
  after,
  className,
  ...inputProps
}: MemberTextFieldProps) {
  const t = useTranslations('BureauMemberProfilesPage')
  const {register, formState} = useFormContext()
  const id = memberFieldIdOf(idPrefix, name)
  const error = formState.errors[name]?.message
  const describedBy = [help && `${id}-help`, error && `${id}-error`]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-base font-medium">
        {t(`fields.${name}.label`)}
        {optional && (
          <>
            {' '}
            <span className="text-muted-foreground font-normal">
              {t('optional')}
            </span>
          </>
        )}
      </Label>
      {help && (
        <p id={`${id}-help`} className="text-muted-foreground text-base">
          {t(`fields.${name}.help`)}
        </p>
      )}
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn(
          'h-14 text-[18px] aria-invalid:border-2 sm:h-12',
          className
        )}
        {...inputProps}
        {...register(name)}
      />
      {error && (
        <p
          id={`${id}-error`}
          className="text-destructive-text text-base font-medium"
        >
          {String(error)}
        </p>
      )}
      {after}
    </div>
  )
}

type MemberContactFieldsProps = {
  idPrefix: string
  /** Ce qui s'ecrit sous le champ email : la fiche qui porte deja l'adresse. */
  afterEmail?: ReactNode
}

/**
 * Les coordonnees d'une fiche (ecrans 2 et 3) : email et telephone
 * facultatifs, adresse structuree pour le publipostage. L'encart « courrier
 * uniquement » suit la saisie : visible tant que l'email est vide.
 */
export function MemberContactFields({
  idPrefix,
  afterEmail,
}: MemberContactFieldsProps) {
  const t = useTranslations('BureauMemberProfilesPage')
  const email = useWatch({name: 'email'}) as string | undefined

  return (
    <div className="flex flex-col gap-6">
      <MemberTextField
        idPrefix={idPrefix}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        optional
        help
        after={afterEmail}
      />
      <MemberTextField
        idPrefix={idPrefix}
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="off"
        optional
        className="sm:max-w-xs"
      />
      <MemberTextField
        idPrefix={idPrefix}
        name="addressLine"
        autoComplete="off"
      />
      <MemberTextField
        idPrefix={idPrefix}
        name="addressComplement"
        autoComplete="off"
        optional
      />
      <div className="grid gap-6 sm:grid-cols-[10rem_1fr]">
        <MemberTextField
          idPrefix={idPrefix}
          name="postalCode"
          inputMode="numeric"
          autoComplete="off"
          className="font-mono font-medium tabular-nums"
        />
        <MemberTextField idPrefix={idPrefix} name="city" autoComplete="off" />
      </div>
      {!email?.trim() && (
        <p className="bg-muted rounded-md px-4 py-3 text-base">
          {t('mailOnlyNotice')}
        </p>
      )}
    </div>
  )
}

/**
 * Resume ancre des erreurs : « N champs a corriger. Rien n'a ete
 * enregistre. », chaque ligne menant a son champ.
 */
export function MemberFormErrorSummary({
  idPrefix,
  fields,
}: {
  idPrefix: string
  fields: readonly MemberProfileFormField[]
}) {
  const t = useTranslations('BureauMemberProfilesPage')
  const {formState} = useFormContext()
  const invalid = fields.filter((field) => formState.errors[field])

  if (invalid.length === 0) return null

  return (
    <Alert
      variant="destructive"
      className="border-destructive border-2 [&>svg]:size-5"
    >
      <AlertTriangle aria-hidden="true" />
      <AlertTitle className="text-destructive-text line-clamp-none text-base font-bold">
        {t('summary', {count: invalid.length})}
      </AlertTitle>
      <AlertDescription className="text-foreground text-base">
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {invalid.map((field) => (
            <li key={field}>
              <a
                href={`#${memberFieldIdOf(idPrefix, field)}`}
                className="underline underline-offset-4"
              >
                {String(formState.errors[field]?.message)}
              </a>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
