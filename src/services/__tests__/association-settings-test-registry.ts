import type {AssociationSettingsRegistry} from '../types/domain/association-settings-types'

/**
 * Registre de test (s02, critere 2) : une cle de chaque type que le registre
 * sait porter. Aucune de ces cles n'existe en production ; elles prouvent que
 * la validation et la page suivent le registre sans etre modifiees.
 *
 * Les libelles sont des exemples de la planche C du design, fournis aux tests
 * de composant par `ASSOCIATION_SETTINGS_TEST_MESSAGES`, jamais par
 * `messages/*.json`.
 */
export const TEST_SETTINGS_REGISTRY: AssociationSettingsRegistry = [
  {
    key: 'test.required_email',
    type: 'email',
    required: true,
    labelKey: 'test.requiredEmail.label',
    helpKey: 'test.requiredEmail.help',
    page: 'settings',
  },
  {
    key: 'test.optional_email',
    type: 'email',
    required: false,
    default: {fromKey: 'test.required_email'},
    labelKey: 'test.optionalEmail.label',
    helpKey: 'test.optionalEmail.help',
    page: 'settings',
  },
  {
    key: 'test.number',
    type: 'number',
    required: false,
    default: {value: '30'},
    min: 1,
    max: 365,
    integer: true,
    unitKey: 'test.number.unit',
    labelKey: 'test.number.label',
    helpKey: 'test.number.help',
    page: 'settings',
  },
  {
    key: 'test.boolean',
    type: 'boolean',
    required: false,
    default: {value: 'false'},
    labelKey: 'test.boolean.label',
    helpKey: 'test.boolean.help',
    page: 'settings',
  },
  {
    key: 'test.choice_few',
    type: 'choice',
    required: false,
    default: {value: 'monthly'},
    options: [
      {value: 'weekly', labelKey: 'test.choiceFew.weekly'},
      {value: 'monthly', labelKey: 'test.choiceFew.monthly'},
      {value: 'yearly', labelKey: 'test.choiceFew.yearly'},
    ],
    labelKey: 'test.choiceFew.label',
    helpKey: 'test.choiceFew.help',
    page: 'settings',
  },
  {
    key: 'test.choice_many',
    type: 'choice',
    required: false,
    options: [
      {value: 'north', labelKey: 'test.choiceMany.north'},
      {value: 'south', labelKey: 'test.choiceMany.south'},
      {value: 'east', labelKey: 'test.choiceMany.east'},
      {value: 'west', labelKey: 'test.choiceMany.west'},
    ],
    labelKey: 'test.choiceMany.label',
    helpKey: 'test.choiceMany.help',
    page: 'settings',
  },
  {
    key: 'test.identity_only',
    type: 'boolean',
    required: false,
    default: {value: 'true'},
    labelKey: 'test.identityOnly.label',
    helpKey: 'test.identityOnly.help',
    page: 'identity',
  },
]

export const ASSOCIATION_SETTINGS_TEST_MESSAGES = {
  test: {
    requiredEmail: {
      label: 'Adresse du secrétariat',
      help: 'Reçoit les messages du bureau.',
    },
    optionalEmail: {
      label: 'Adresse du trésorier',
      help: 'Reçoit les questions sur les factures.',
    },
    number: {
      label: 'Délai avant relance',
      help: 'Nombre de jours avant le premier rappel.',
      unit: 'jours',
    },
    boolean: {
      label: 'Relances activées',
      help: 'Envoie les rappels automatiquement.',
    },
    choiceFew: {
      label: 'Fréquence du bulletin',
      help: 'Rythme d’envoi du bulletin.',
      weekly: 'Chaque semaine',
      monthly: 'Chaque mois',
      yearly: 'Chaque année',
    },
    choiceMany: {
      label: 'Secteur de rattachement',
      help: 'Secteur du domaine.',
      north: 'Nord',
      south: 'Sud',
      east: 'Est',
      west: 'Ouest',
    },
    identityOnly: {
      label: 'Réglage de la page Identité',
      help: 'Ne doit pas apparaître dans les réglages.',
    },
  },
}
