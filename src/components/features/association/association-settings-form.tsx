'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {CircleAlert, CircleCheck} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {ReactNode, useState} from 'react'
import {Controller, FieldErrors, useForm, useWatch} from 'react-hook-form'

import type {AssociationSettingsFormState} from '@/app/[locale]/(bureau)/bureau/reglages/actions'
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {Checkbox} from '@/components/ui/checkbox'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {RadioGroup, RadioGroupItem} from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {cn} from '@/lib/utils'
import {
  AssociationSettingDefinition,
  AssociationSettingError,
  ChoiceSettingDefinition,
  NumberSettingDefinition,
  ResolvedAssociationSettings,
} from '@/services/types/domain/association-settings-types'

import {
  AssociationSettingsFormValues,
  createAssociationSettingsFormSchema,
  toSettingError,
  toSettingFieldName,
} from './association-settings-form-validation'

export type AssociationSettingsSaveAction = (
  prevState: AssociationSettingsFormState | undefined,
  formData: FormData
) => Promise<AssociationSettingsFormState>

type AssociationSettingsFormProps = {
  /** Les definitions de la page, dans l'ordre du registre. */
  definitions: readonly AssociationSettingDefinition[]
  settings: ResolvedAssociationSettings
  saveAction: AssociationSettingsSaveAction
}

/** Valeurs indexees par cle du registre. */
type Values = Record<string, string>

type Feedback =
  | {status: 'idle'}
  | {status: 'success'; message: string}
  | {status: 'error'; message?: string; kept?: string}

/** Au-dela de ce nombre d'options, un choix se fait dans un `select`. */
const MAX_RADIO_OPTIONS = 3

const fieldId = (key: string) => `setting-${key.replaceAll('.', '-')}`

/**
 * Valeur affichee dans le champ : la valeur renseignee ; pour un booleen ou un
 * choix, la valeur en vigueur (defaut compris), sinon rien.
 */
const initialValue = (
  definition: AssociationSettingDefinition,
  settings: ResolvedAssociationSettings
): string => {
  const resolved = settings[definition.key]
  if (definition.type === 'boolean' || definition.type === 'choice') {
    return resolved?.value === null || resolved?.value === undefined
      ? ''
      : String(resolved.value)
  }
  return resolved?.storedValue ?? ''
}

const initialFormValues = (
  definitions: readonly AssociationSettingDefinition[],
  settings: ResolvedAssociationSettings
): AssociationSettingsFormValues =>
  Object.fromEntries(
    definitions.map((definition) => [
      toSettingFieldName(definition.key),
      initialValue(definition, settings),
    ])
  )

const storedKeysOf = (
  definitions: readonly AssociationSettingDefinition[],
  settings: ResolvedAssociationSettings
): ReadonlySet<string> =>
  new Set(
    definitions
      .filter((definition) => {
        const stored = settings[definition.key]?.storedValue
        return stored !== null && stored !== undefined
      })
      .map((definition) => definition.key)
  )

/**
 * Les modifications a envoyer, par cle du registre. Un parametre sans valeur
 * enregistree que l'utilisateur n'a pas modifie n'est pas envoye : son defaut
 * reste implicite, une ligne absente (ADR 016).
 */
const changesToSend = (
  definitions: readonly AssociationSettingDefinition[],
  values: AssociationSettingsFormValues,
  baseline: AssociationSettingsFormValues,
  storedKeys: ReadonlySet<string>
): Values =>
  Object.fromEntries(
    definitions
      .map((definition) => {
        const name = toSettingFieldName(definition.key)
        return [definition.key, values[name] ?? '', baseline[name]] as const
      })
      .filter(
        ([key, value, initial]) => storedKeys.has(key) || value !== initial
      )
      .map(([key, value]) => [key, value])
  )

const changesToFormData = (changes: Values): FormData => {
  const formData = new FormData()
  for (const [key, value] of Object.entries(changes)) formData.set(key, value)
  return formData
}

const nextStoredKeys = (
  storedKeys: ReadonlySet<string>,
  sent: Values
): ReadonlySet<string> => {
  const next = new Set(storedKeys)
  for (const [key, value] of Object.entries(sent)) {
    if (value.trim() === '') next.delete(key)
    else next.add(key)
  }
  return next
}

const settingErrorOf = (
  definition: AssociationSettingDefinition,
  errors: FieldErrors<AssociationSettingsFormValues>
): AssociationSettingError | undefined =>
  toSettingError(
    definition,
    errors[toSettingFieldName(definition.key)]?.message
  )

/**
 * Formulaire des reglages d'une association (s02, ecran B), **genere par le
 * registre** : chaque definition s'affiche selon son type (planche C), sans
 * que le composant connaisse aucune cle. react-hook-form + zod : le schema
 * applique les regles du registre, les memes que le serveur ; validation au
 * _blur_ puis a l'envoi ; tout ou rien.
 */
export function AssociationSettingsForm({
  definitions,
  settings,
  saveAction,
}: AssociationSettingsFormProps) {
  const t = useTranslations('BureauSettingsPage')
  const form = useForm<AssociationSettingsFormValues>({
    resolver: zodResolver(createAssociationSettingsFormSchema(definitions)),
    defaultValues: initialFormValues(definitions, settings),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    shouldFocusError: false,
  })
  const watchedValues = useWatch({control: form.control})
  const [baseline, setBaseline] = useState<AssociationSettingsFormValues>(
    () => initialFormValues(definitions, settings)
  )
  const [storedKeys, setStoredKeys] = useState(() =>
    storedKeysOf(definitions, settings)
  )
  const [savedValues, setSavedValues] = useState<Values>(() =>
    Object.fromEntries(
      definitions.map((definition) => [
        definition.key,
        String(settings[definition.key]?.value ?? ''),
      ])
    )
  )
  const [showSummary, setShowSummary] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>({status: 'idle'})
  const {errors, isSubmitting} = form.formState

  const applyResult = (
    result: AssociationSettingsFormState,
    values: AssociationSettingsFormValues,
    sent: Values
  ) => {
    if (result.success) {
      setSavedValues((current) => ({
        ...current,
        ...Object.fromEntries(
          Object.entries(sent).map(([key, value]) => [key, value.trim()])
        ),
      }))
      setBaseline(values)
      setStoredKeys((current) => nextStoredKeys(current, sent))
      setFeedback({status: 'success', message: result.message ?? ''})
      return
    }
    if (result.fieldErrors) {
      for (const [key, error] of Object.entries(result.fieldErrors)) {
        form.setError(toSettingFieldName(key), {
          type: 'server',
          message: error.code,
        })
      }
      setShowSummary(true)
      return
    }
    setFeedback({status: 'error', message: result.message, kept: result.kept})
  }

  const onValid = async (values: AssociationSettingsFormValues) => {
    setShowSummary(false)
    setFeedback({status: 'idle'})
    const sent = changesToSend(definitions, values, baseline, storedKeys)
    try {
      applyResult(
        await saveAction(undefined, changesToFormData(sent)),
        values,
        sent
      )
    } catch {
      setFeedback({
        status: 'error',
        message: t('errors.failed'),
        kept: t('errors.kept'),
      })
    }
  }

  const onInvalid = () => {
    setShowSummary(true)
    setFeedback({status: 'idle'})
  }

  const erroredDefinitions = definitions.filter((definition) =>
    settingErrorOf(definition, errors)
  )

  return (
    <form
      onSubmit={form.handleSubmit(onValid, onInvalid)}
      noValidate
      className="flex flex-col gap-6"
    >
      {showSummary && erroredDefinitions.length > 0 ? (
        <ErrorSummary definitions={erroredDefinitions} />
      ) : (
        !isSubmitting && <FormFeedback feedback={feedback} />
      )}

      <Card className="gap-4 px-4 py-4 shadow-none sm:px-6 sm:py-6">
        <CardHeader className="px-0">
          <CardTitle>
            <h3 className="text-xl leading-snug font-semibold">
              {t('cards.notifications.title')}
            </h3>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 px-0">
          {definitions.map((definition) => (
            <Controller
              key={definition.key}
              control={form.control}
              name={toSettingFieldName(definition.key)}
              render={({field}) => (
                <SettingField
                  definition={definition}
                  value={field.value ?? ''}
                  error={settingErrorOf(definition, errors)}
                  currentValue={savedValues[definition.key] ?? ''}
                  defaultValue={effectiveDefault(
                    definition,
                    watchedValues,
                    settings
                  )}
                  disabled={isSubmitting}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          ))}
        </CardContent>
      </Card>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="h-14 w-full sm:h-12 sm:w-auto sm:min-w-64 sm:self-start"
      >
        {isSubmitting ? t('saving') : t('submit')}
      </Button>
    </form>
  )
}

/**
 * La valeur qui s'applique quand le champ est vide : celle de la cle de
 * reference telle que saisie, sinon telle qu'enregistree ; ou le defaut
 * constant du registre.
 */
const effectiveDefault = (
  definition: AssociationSettingDefinition,
  values: Partial<AssociationSettingsFormValues>,
  settings: ResolvedAssociationSettings
): string | undefined => {
  if (!definition.default) return undefined
  if ('fromKey' in definition.default) {
    const typed =
      values[toSettingFieldName(definition.default.fromKey)]?.trim()
    const stored = settings[definition.default.fromKey]?.value
    return (
      typed ||
      (stored === null || stored === undefined ? undefined : String(stored))
    )
  }
  return definition.default.value
}

type SettingFieldProps = {
  definition: AssociationSettingDefinition
  value: string
  error?: AssociationSettingError
  /** Valeur en vigueur, pour dire ce qui reste applique apres un refus. */
  currentValue: string
  defaultValue?: string
  disabled: boolean
  onChange: (value: string) => void
  onBlur: () => void
}

function SettingField(props: SettingFieldProps) {
  const {definition, value, error, currentValue, defaultValue} = props
  const t = useTranslations('AssociationSettings')
  const id = fieldId(definition.key)
  const helpId = `${id}-help`
  const errorId = `${id}-error`
  const describedBy = error ? `${helpId} ${errorId}` : helpId
  const showDefault =
    !error &&
    !definition.required &&
    value.trim() === '' &&
    defaultValue !== undefined &&
    (definition.type === 'email' || definition.type === 'number')

  const label = (
    <>
      {t(definition.labelKey)}
      {!definition.required && (
        <span className="text-muted-foreground font-normal">
          {' — '}
          {t('optional')}
        </span>
      )}
    </>
  )

  return (
    <div data-setting={definition.key} className="flex flex-col gap-2">
      {definition.type === 'boolean' ? (
        <BooleanControl {...props} id={id} describedBy={describedBy}>
          {label}
        </BooleanControl>
      ) : (
        <>
          <Label
            id={`${id}-label`}
            htmlFor={id}
            className="text-base leading-snug font-medium"
          >
            {label}
          </Label>
          <p id={helpId} className="text-muted-foreground text-base">
            {t(definition.helpKey)}
          </p>
          <SettingControl {...props} id={id} describedBy={describedBy} />
        </>
      )}
      {definition.type === 'boolean' && (
        <p id={helpId} className="text-muted-foreground text-base">
          {t(definition.helpKey)}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          className="text-destructive flex items-start gap-2 text-base"
        >
          <CircleAlert
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0"
            strokeWidth={1.75}
          />
          <span>
            {t(
              definition.errorMessageKeys?.[error.code] ??
                `errors.${error.code}`,
              {
                min: error.min ?? '',
                max: error.max ?? '',
                current: currentValue,
              }
            )}
          </span>
        </p>
      )}
      {showDefault && (
        <p className="text-foreground text-base">
          {definition.whenEmptyKey
            ? t(definition.whenEmptyKey, {value: defaultValue})
            : t('usesDefault', {value: defaultValue})}
        </p>
      )}
    </div>
  )
}

type ControlProps = SettingFieldProps & {id: string; describedBy: string}

const invalidClass = 'aria-invalid:border-2'

function SettingControl(props: ControlProps) {
  const {definition} = props
  switch (definition.type) {
    case 'email':
      return <TextControl {...props} type="email" />
    case 'number':
      return <NumberControl {...props} definition={definition} />
    case 'choice':
      return definition.options.length <= MAX_RADIO_OPTIONS ? (
        <RadioControl {...props} definition={definition} />
      ) : (
        <SelectControl {...props} definition={definition} />
      )
    default:
      return null
  }
}

function TextControl({
  id,
  describedBy,
  value,
  error,
  disabled,
  onChange,
  onBlur,
  type,
  className,
  inputMode,
}: ControlProps & {
  type: 'email' | 'text'
  className?: string
  inputMode?: 'numeric' | 'decimal'
}) {
  return (
    <Input
      id={id}
      name={id}
      type={type}
      inputMode={inputMode}
      value={value}
      disabled={disabled}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      className={cn(invalidClass, className)}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
    />
  )
}

function NumberControl(
  props: ControlProps & {definition: NumberSettingDefinition}
) {
  const t = useTranslations('AssociationSettings')
  const {definition} = props
  return (
    <div className="flex items-center gap-3">
      <TextControl
        {...props}
        type="text"
        inputMode={definition.integer ? 'numeric' : 'decimal'}
        className="max-w-40 font-mono tabular-nums"
      />
      {definition.unitKey && (
        <span className="text-foreground text-base">
          {t(definition.unitKey)}
        </span>
      )}
    </div>
  )
}

function BooleanControl({
  id,
  describedBy,
  value,
  error,
  disabled,
  onChange,
  children,
}: ControlProps & {children: ReactNode}) {
  return (
    <div className="flex items-center gap-3">
      <Checkbox
        id={id}
        checked={value === 'true'}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="size-5"
        onCheckedChange={(checked) =>
          onChange(checked === true ? 'true' : 'false')
        }
      />
      <Label htmlFor={id} className="text-base leading-snug font-medium">
        {children}
      </Label>
    </div>
  )
}

function RadioControl({
  id,
  describedBy,
  value,
  error,
  disabled,
  onChange,
  definition,
}: ControlProps & {definition: ChoiceSettingDefinition}) {
  const t = useTranslations('AssociationSettings')
  return (
    <RadioGroup
      id={id}
      value={value}
      disabled={disabled}
      aria-labelledby={`${id}-label`}
      aria-describedby={describedBy}
      aria-invalid={error ? true : undefined}
      onValueChange={onChange}
    >
      {definition.options.map((option) => (
        <div key={option.value} className="flex min-h-11 items-center gap-3">
          <RadioGroupItem
            id={`${id}-${option.value}`}
            value={option.value}
            className="size-5"
          />
          <Label htmlFor={`${id}-${option.value}`} className="text-base">
            {t(option.labelKey)}
          </Label>
        </div>
      ))}
    </RadioGroup>
  )
}

function SelectControl({
  id,
  describedBy,
  value,
  error,
  disabled,
  onChange,
  definition,
}: ControlProps & {definition: ChoiceSettingDefinition}) {
  const t = useTranslations('AssociationSettings')
  const tPage = useTranslations('BureauSettingsPage')
  return (
    <Select
      value={value === '' ? undefined : value}
      disabled={disabled}
      onValueChange={onChange}
    >
      <SelectTrigger
        id={id}
        aria-labelledby={`${id}-label`}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={cn(invalidClass, 'sm:max-w-80')}
      >
        <SelectValue placeholder={tPage('choose')} />
      </SelectTrigger>
      <SelectContent>
        {definition.options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {t(option.labelKey)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function ErrorSummary({
  definitions,
}: {
  definitions: readonly AssociationSettingDefinition[]
}) {
  const t = useTranslations('BureauSettingsPage')
  const tSettings = useTranslations('AssociationSettings')
  return (
    <Alert variant="destructive" className="border-destructive">
      <CircleAlert strokeWidth={1.75} />
      <AlertTitle className="text-[17px] font-semibold">
        {t('summary.title', {count: definitions.length})}
      </AlertTitle>
      <AlertDescription className="text-foreground text-[17px]">
        <ul className="flex flex-col gap-1">
          {definitions.map((definition) => (
            <li key={definition.key}>
              <a
                href={`#${fieldId(definition.key)}`}
                className="text-link underline"
              >
                {tSettings(definition.labelKey)}
              </a>
            </li>
          ))}
        </ul>
        <p>{t('summary.kept')}</p>
      </AlertDescription>
    </Alert>
  )
}

function FormFeedback({feedback}: {feedback: Feedback}) {
  if (feedback.status === 'success') {
    return (
      <Alert role="status">
        <CircleCheck className="text-primary" strokeWidth={1.75} />
        <AlertDescription className="text-foreground text-[17px]">
          {feedback.message}
        </AlertDescription>
      </Alert>
    )
  }

  if (feedback.status !== 'error') return null

  return (
    <Alert variant="destructive" className="border-destructive">
      <CircleAlert strokeWidth={1.75} />
      <AlertDescription className="text-foreground text-[17px]">
        <p>
          {feedback.message}
          {feedback.kept && (
            <>
              {' '}
              <strong>{feedback.kept}</strong>
            </>
          )}
        </p>
      </AlertDescription>
    </Alert>
  )
}
