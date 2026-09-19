import {z} from 'zod'

/**
 * Parametres d'une association (ADR 010, ADR 016).
 *
 * La **definition** d'un parametre vit ici, dans un registre type ; la table
 * `organization_setting` ne stocke que des valeurs. Absence de ligne = valeur
 * par defaut du registre. Module isomorphe : les regles pures servent au
 * service, au DAL et au formulaire, sans aucune dependance serveur.
 *
 * Aucune valeur propre a une association dans ce fichier : un defaut est une
 * constante neutre ou une reference a une autre cle.
 */

/** Page du back-office qui affiche le parametre. */
export type AssociationSettingPage = 'settings' | 'identity'

/** Defaut constant (valeur brute, comme en base) ou reference a une autre cle. */
export type AssociationSettingDefault = {value: string} | {fromKey: string}

type AssociationSettingDefinitionBase = {
  key: string
  required: boolean
  default?: AssociationSettingDefault
  /** Cles de traduction, dans le namespace `AssociationSettings`. */
  labelKey: string
  helpKey: string
  /** Message propre a ce parametre pour un code de refus donne. */
  errorMessageKeys?: Partial<Record<AssociationSettingErrorCode, string>>
  /** Phrase affichee sous le champ vide, qui dit la valeur par defaut. */
  whenEmptyKey?: string
  page: AssociationSettingPage
}

export type EmailSettingDefinition = AssociationSettingDefinitionBase & {
  type: 'email'
}

export type NumberSettingDefinition = AssociationSettingDefinitionBase & {
  type: 'number'
  min?: number
  max?: number
  integer?: boolean
  unitKey?: string
}

export type BooleanSettingDefinition = AssociationSettingDefinitionBase & {
  type: 'boolean'
}

export type ChoiceSettingOption = {value: string; labelKey: string}

export type ChoiceSettingDefinition = AssociationSettingDefinitionBase & {
  type: 'choice'
  options: readonly ChoiceSettingOption[]
}

export type AssociationSettingDefinition =
  | EmailSettingDefinition
  | NumberSettingDefinition
  | BooleanSettingDefinition
  | ChoiceSettingDefinition

export type AssociationSettingType = AssociationSettingDefinition['type']

export type AssociationSettingsRegistry =
  readonly AssociationSettingDefinition[]

export type AssociationSettingValue = string | number | boolean

export const ASSOCIATION_SETTING_ERROR_CODES = [
  'required',
  'invalidEmail',
  'invalidNumber',
  'belowMin',
  'aboveMax',
  'invalidBoolean',
  'invalidChoice',
  'unknownKey',
] as const

export type AssociationSettingErrorCode =
  (typeof ASSOCIATION_SETTING_ERROR_CODES)[number]

export type AssociationSettingError = {
  code: AssociationSettingErrorCode
  min?: number
  max?: number
}

export type AssociationSettingParseResult =
  | {valid: true; value: AssociationSettingValue; normalized: string}
  | {valid: false; error: AssociationSettingError}

/** Valeur lue d'un parametre, defaut applique. */
export type ResolvedAssociationSetting = {
  /** Valeur en vigueur : stockee, sinon defaut ; `null` sans l'un ni l'autre. */
  value: AssociationSettingValue | null
  /** Valeur brute stockee et valide ; `null` si le parametre n'est pas renseigne. */
  storedValue: string | null
  /** Cle dont la valeur s'applique quand celle-ci n'est pas renseignee. */
  defaultFromKey: string | null
}

export type ResolvedAssociationSettings = Record<
  string,
  ResolvedAssociationSetting
>

export type AssociationSettingRow = {key: string; value: string}

export type AssociationSettingsChangesValidation =
  | {
      valid: true
      upserts: AssociationSettingRow[]
      deletions: string[]
    }
  | {valid: false; errors: Record<string, AssociationSettingError>}

export const CONTACT_EMAIL_SETTING_KEY = 'contact.email'
export const FORAGE_EMAIL_SETTING_KEY = 'forage.responsable.email'
export const ACCENT_HUE_SETTING_KEY = 'identity.accent_hue'
export const MAGIC_LINK_REQUESTS_PER_ADDRESS_SETTING_KEY =
  'login.link_requests_per_address_per_hour'
export const MAGIC_LINK_REQUESTS_PER_NETWORK_SETTING_KEY =
  'login.link_requests_per_network_per_hour'

/**
 * Les six teintes d'accent validees (design system §1.2). Le bureau choisit
 * dans cette liste, jamais au selecteur libre.
 */
export const ACCENT_HUES = [
  {hue: 195, name: 'water'},
  {hue: 150, name: 'pines'},
  {hue: 255, name: 'lake'},
  {hue: 40, name: 'tile'},
  {hue: 300, name: 'heather'},
  {hue: 95, name: 'broom'},
] as const

export type AccentHue = (typeof ACCENT_HUES)[number]['hue']
export type AccentHueName = (typeof ACCENT_HUES)[number]['name']

export const DEFAULT_ACCENT_HUE: AccentHue = 195

export const isAccentHue = (value: unknown): value is AccentHue =>
  ACCENT_HUES.some(({hue}) => hue === value)

export const getAccentHueName = (hue: AccentHue): AccentHueName =>
  ACCENT_HUES.find((candidate) => candidate.hue === hue)?.name ?? 'water'

/** Le registre de production. */
export const ASSOCIATION_SETTINGS_REGISTRY: AssociationSettingsRegistry = [
  {
    key: CONTACT_EMAIL_SETTING_KEY,
    type: 'email',
    required: true,
    labelKey: 'fields.contactEmail.label',
    helpKey: 'fields.contactEmail.help',
    errorMessageKeys: {required: 'fields.contactEmail.errors.required'},
    page: 'settings',
  },
  {
    key: FORAGE_EMAIL_SETTING_KEY,
    type: 'email',
    required: false,
    default: {fromKey: CONTACT_EMAIL_SETTING_KEY},
    labelKey: 'fields.forageEmail.label',
    helpKey: 'fields.forageEmail.help',
    whenEmptyKey: 'fields.forageEmail.whenEmpty',
    page: 'settings',
  },
  {
    key: ACCENT_HUE_SETTING_KEY,
    type: 'choice',
    required: false,
    default: {value: String(DEFAULT_ACCENT_HUE)},
    options: ACCENT_HUES.map(({hue, name}) => ({
      value: String(hue),
      labelKey: `hues.${name}`,
    })),
    labelKey: 'fields.accentHue.label',
    helpKey: 'fields.accentHue.help',
    page: 'identity',
  },
  {
    key: MAGIC_LINK_REQUESTS_PER_ADDRESS_SETTING_KEY,
    type: 'number',
    required: false,
    default: {value: '5'},
    min: 1,
    max: 100,
    integer: true,
    unitKey: 'units.requestsPerHour',
    labelKey: 'fields.linkRequestsPerAddress.label',
    helpKey: 'fields.linkRequestsPerAddress.help',
    page: 'settings',
  },
  {
    key: MAGIC_LINK_REQUESTS_PER_NETWORK_SETTING_KEY,
    type: 'number',
    required: false,
    default: {value: '30'},
    min: 1,
    max: 1000,
    integer: true,
    unitKey: 'units.requestsPerHour',
    labelKey: 'fields.linkRequestsPerNetwork.label',
    helpKey: 'fields.linkRequestsPerNetwork.help',
    page: 'settings',
  },
]

const emailSchema = z.email()

const accepted = (
  value: AssociationSettingValue,
  normalized: string
): AssociationSettingParseResult => ({valid: true, value, normalized})

const refused = (
  error: AssociationSettingError
): AssociationSettingParseResult => ({valid: false, error})

const parseEmail = (raw: string): AssociationSettingParseResult =>
  emailSchema.safeParse(raw).success
    ? accepted(raw, raw)
    : refused({code: 'invalidEmail'})

const parseNumber = (
  definition: NumberSettingDefinition,
  raw: string
): AssociationSettingParseResult => {
  const pattern = definition.integer ? /^-?\d+$/ : /^-?\d+(\.\d+)?$/
  if (!pattern.test(raw)) return refused({code: 'invalidNumber'})

  const value = Number(raw)
  if (definition.min !== undefined && value < definition.min) {
    return refused({code: 'belowMin', min: definition.min})
  }
  if (definition.max !== undefined && value > definition.max) {
    return refused({code: 'aboveMax', max: definition.max})
  }
  return accepted(value, String(value))
}

const parseBoolean = (raw: string): AssociationSettingParseResult =>
  raw === 'true' || raw === 'false'
    ? accepted(raw === 'true', raw)
    : refused({code: 'invalidBoolean'})

const parseChoice = (
  definition: ChoiceSettingDefinition,
  raw: string
): AssociationSettingParseResult =>
  definition.options.some((option) => option.value === raw)
    ? accepted(raw, raw)
    : refused({code: 'invalidChoice'})

/**
 * Valide une valeur brute selon le type declare. Une valeur vide est refusee
 * (`required`) : vider un parametre se traite dans `validateSettingsChanges`.
 */
export const parseSettingValue = (
  definition: AssociationSettingDefinition,
  raw: string
): AssociationSettingParseResult => {
  if (raw.trim() === '') return refused({code: 'required'})
  const trimmed = definition.type === 'boolean' ? raw : raw.trim()

  switch (definition.type) {
    case 'email':
      return parseEmail(trimmed)
    case 'number':
      return parseNumber(definition, trimmed)
    case 'boolean':
      return parseBoolean(trimmed)
    case 'choice':
      return parseChoice(definition, trimmed)
  }
}

export const getSettingsForPage = (
  registry: AssociationSettingsRegistry,
  page: AssociationSettingPage
): AssociationSettingDefinition[] =>
  registry.filter((definition) => definition.page === page)

const findDefinition = (
  registry: AssociationSettingsRegistry,
  key: string
): AssociationSettingDefinition | undefined =>
  registry.find((definition) => definition.key === key)

/** Vrai si une chaine de references de defaut revient sur elle-meme. */
export const hasSettingReferenceCycle = (
  registry: AssociationSettingsRegistry
): boolean =>
  registry.some((start) => {
    const visited = new Set<string>([start.key])
    let current: AssociationSettingDefinition | undefined = start
    while (current?.default && 'fromKey' in current.default) {
      const next = current.default.fromKey
      if (visited.has(next)) return true
      visited.add(next)
      current = findDefinition(registry, next)
    }
    return false
  })

const storedValidValues = (
  registry: AssociationSettingsRegistry,
  rows: readonly AssociationSettingRow[]
): Map<string, {raw: string; value: AssociationSettingValue}> => {
  const values = new Map<
    string,
    {raw: string; value: AssociationSettingValue}
  >()
  for (const row of rows) {
    const definition = findDefinition(registry, row.key)
    if (!definition) continue
    const parsed = parseSettingValue(definition, row.value)
    if (parsed.valid) {
      values.set(row.key, {raw: parsed.normalized, value: parsed.value})
    }
  }
  return values
}

const resolveValue = (
  registry: AssociationSettingsRegistry,
  stored: Map<string, {raw: string; value: AssociationSettingValue}>,
  key: string,
  visited: Set<string>
): AssociationSettingValue | null => {
  const definition = findDefinition(registry, key)
  if (!definition || visited.has(key)) return null

  const own = stored.get(key)
  if (own) return own.value
  if (!definition.default) return null

  if ('fromKey' in definition.default) {
    return resolveValue(
      registry,
      stored,
      definition.default.fromKey,
      new Set([...visited, key])
    )
  }

  const parsed = parseSettingValue(definition, definition.default.value)
  return parsed.valid ? parsed.value : null
}

/**
 * Lit les parametres d'une association : valeur stockee, sinon defaut du
 * registre (constante ou autre cle). Une ligne hors registre est ignoree ;
 * une valeur stockee invalide se lit comme absente (ADR 016).
 */
export const resolveSettings = (
  registry: AssociationSettingsRegistry,
  rows: readonly AssociationSettingRow[]
): ResolvedAssociationSettings => {
  const stored = storedValidValues(registry, rows)

  return Object.fromEntries(
    registry.map((definition) => [
      definition.key,
      {
        value: resolveValue(registry, stored, definition.key, new Set()),
        storedValue: stored.get(definition.key)?.raw ?? null,
        defaultFromKey:
          !stored.has(definition.key) &&
          definition.default &&
          'fromKey' in definition.default
            ? definition.default.fromKey
            : null,
      },
    ])
  )
}

/**
 * Valide un lot de modifications, tout ou rien. Un parametre facultatif vide
 * est a supprimer (retour au defaut) ; un parametre obligatoire vide est
 * refuse ; une cle hors registre est refusee.
 */
export const validateSettingsChanges = (
  registry: AssociationSettingsRegistry,
  changes: Readonly<Record<string, string>>
): AssociationSettingsChangesValidation => {
  const upserts: AssociationSettingRow[] = []
  const deletions: string[] = []
  const errors: Record<string, AssociationSettingError> = {}

  for (const [key, raw] of Object.entries(changes)) {
    const definition = findDefinition(registry, key)
    if (!definition) {
      errors[key] = {code: 'unknownKey'}
      continue
    }

    if (raw.trim() === '') {
      if (definition.required) errors[key] = {code: 'required'}
      else deletions.push(key)
      continue
    }

    const parsed = parseSettingValue(definition, raw)
    if (parsed.valid) upserts.push({key, value: parsed.normalized})
    else errors[key] = parsed.error
  }

  return Object.keys(errors).length > 0
    ? {valid: false, errors}
    : {valid: true, upserts, deletions}
}

/** Teinte d'accent en vigueur ; la teinte par defaut si rien de valide. */
export const getAccentHue = (
  settings: ResolvedAssociationSettings
): AccentHue => {
  const value = Number(settings[ACCENT_HUE_SETTING_KEY]?.value)
  return isAccentHue(value) ? value : DEFAULT_ACCENT_HUE
}

/** Seuils horaires de demande de lien de connexion (s03). */
export type MagicLinkRequestLimits = {
  /** Demandes acceptees par adresse email, par heure glissante. */
  perAddress: number
  /** Demandes acceptees par acces internet (IP), par heure glissante. */
  perNetwork: number
}

const numberSettingOf = (
  settings: ResolvedAssociationSettings,
  key: string
): number => {
  const value = settings[key]?.value
  if (typeof value === 'number') return value
  const definition = findDefinition(ASSOCIATION_SETTINGS_REGISTRY, key)
  const fallback =
    definition?.default && 'value' in definition.default
      ? Number(definition.default.value)
      : Number.NaN
  if (Number.isNaN(fallback)) {
    throw new Error(`Parametre numerique sans defaut : ${key}`)
  }
  return fallback
}

/** Seuils en vigueur : valeur du bureau, sinon defaut du registre. */
export const getMagicLinkRequestLimits = (
  settings: ResolvedAssociationSettings
): MagicLinkRequestLimits => ({
  perAddress: numberSettingOf(
    settings,
    MAGIC_LINK_REQUESTS_PER_ADDRESS_SETTING_KEY
  ),
  perNetwork: numberSettingOf(
    settings,
    MAGIC_LINK_REQUESTS_PER_NETWORK_SETTING_KEY
  ),
})
