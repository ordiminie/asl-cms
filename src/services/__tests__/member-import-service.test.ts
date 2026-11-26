import {beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * Base simulee : chaque `withTenant` racine est une transaction. Les
 * ecritures des services s'empilent dans `pending` et ne rejoignent
 * `committed` que si le scope se termine sans erreur — un rejet de ligne
 * n'ecrit donc rien.
 */
const db = vi.hoisted(() => ({
  scope: undefined as string | undefined,
  pending: [] as string[],
  committed: [] as string[],
  profiles: new Map<string, string>(),
  owners: new Map<string, string>(),
  /** Le compte de chaque adresse deja ouverte dans l'association (s53). */
  accounts: new Map<string, string>(),
}))

vi.mock('@/db/tenant-scope', () => ({
  withTenant: vi.fn(async (organizationId: string, callback: () => unknown) => {
    if (db.scope) return callback()
    db.scope = organizationId
    db.pending = []
    try {
      const result = await callback()
      db.committed.push(...db.pending)
      return result
    } finally {
      db.scope = undefined
      db.pending = []
    }
  }),
}))
vi.mock('../member-profile-service', () => ({
  createMemberProfileService: vi.fn(),
  findMemberProfileIdByPennylaneIdService: vi.fn(),
}))
vi.mock('../member-profile-email-service', () => ({
  addMemberProfileEmailService: vi.fn(),
}))
vi.mock('../parcel-ownership-service', () => ({
  attachParcelService: vi.fn(),
}))
vi.mock('../organization-service', () => ({
  getOrganizationByIdService: vi.fn(),
}))
vi.mock('../association-settings-service', () => ({
  getAssociationSettingsService: vi.fn(),
}))
vi.mock('@/db/repositories/member-profile-repository', () => ({
  setMemberProfileImportSnapshotDao: vi.fn(),
}))

import {z} from 'zod'

import {setMemberProfileImportSnapshotDao} from '@/db/repositories/member-profile-repository'
import {logger} from '@/lib/logger'

import {getAssociationSettingsService} from '../association-settings-service'
import {AuthorizationError} from '../errors/authorization-error'
import {ValidationParsedZodError} from '../errors/validation-error'
import {importMembersService} from '../member-import-service'
import {addMemberProfileEmailService} from '../member-profile-email-service'
import {
  createMemberProfileService,
  findMemberProfileIdByPennylaneIdService,
} from '../member-profile-service'
import {getOrganizationByIdService} from '../organization-service'
import {attachParcelService} from '../parcel-ownership-service'
import {
  ASSOCIATION_SETTINGS_REGISTRY,
  AssociationSettingRow,
  MEMBER_DEFAULT_LAND_CITY_SETTING_KEY,
  MEMBER_DEFAULT_LAND_POSTAL_CODE_SETTING_KEY,
  resolveSettings,
} from '../types/domain/association-settings-types'
import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import {
  ImportReportDTO,
  MEMBER_IMPORT_MAX_LINES,
  OWNERSHIP_BEFORE_IMPORT_DATE,
} from '../types/domain/member-import-types'
import {OrganizationRole} from '../types/domain/organization-types'
import {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest, userTestSuperAdmin} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'

const HEADER =
  'Identifiant Client;Dénomination;Adresse;Code Postal;Ville;Pays;Liste d’e-mails;Téléphone;Référence Client'

const line = (fields: {
  id: string
  name: string
  address?: string
  email?: string
  reference?: string
  postalCode?: string
}) =>
  [
    fields.id,
    fields.name,
    fields.address ?? '',
    fields.postalCode ?? (fields.address ? '99100' : ''),
    fields.address ? 'Fictiville' : '',
    'FR',
    fields.email ?? '',
    '',
    fields.reference ?? '',
  ].join(';')

const csv = (...lines: string[]) =>
  new TextEncoder().encode([HEADER, ...lines].join('\n'))

/** Le fichier fictif de reference : 6 lignes, 2 rejetees. */
const FILE = csv(
  // Ligne 2 et 3 : un meme client, deux parcelles (critere 4)
  line({
    id: 'c-001',
    name: 'Lucie Fictive',
    address: '1 allée des Essais',
    email: 'lucie@exemple.test',
    reference: 'ZZ 101 - 00XX000001',
  }),
  line({
    id: 'c-001',
    name: 'Lucie Fictive',
    address: '1 allée des Essais',
    email: 'lucie@exemple.test',
    reference: 'ZZ 102 - 00XX000002',
  }),
  // Ligne 4 : sans email, courrier uniquement (critere 5)
  line({
    id: 'c-002',
    name: 'Marc Inventé',
    address: '2 rue du Test',
    reference: 'ZZ 103 - 00XX000003',
  }),
  // Ligne 5 : ni adresse ni email (critere 3)
  line({id: 'c-003', name: 'Sans Contact', reference: 'ZZ 104 - 00XX000004'}),
  // Ligne 6 : email deja porte par une fiche existante (s53 : rejoint son compte)
  line({
    id: 'c-004',
    name: 'Nora Doublon',
    address: '4 place de l’Essai',
    email: 'pris@exemple.test',
    reference: 'ZZ 105 - 00XX000005',
  }),
  // Ligne 7 : valide, apres les rejets (critere 6)
  line({
    id: 'c-005',
    name: 'Paul Suivant',
    email: 'paul@exemple.test',
    reference: 'ZZ 106 - 00XX000006',
  })
)

const withRole = (role: OrganizationRole): User => ({
  ...userTest,
  organizations: [
    {
      id: 'membership',
      organizationId: ORG_ID,
      userId: userTest.id,
      role,
      createdAt: new Date(),
    },
  ],
})

const run = async (content = FILE): Promise<ImportReportDTO> => {
  const result = await importMembersService({organizationId: ORG_ID, content})
  if (result.status !== 'imported') {
    throw new Error(`import refuse : ${result.status}`)
  }
  return result.report
}

/** Les reglages de l'association visee, lus par l'import (s55). */
const settingRows = vi.hoisted(() => ({current: [] as unknown[]}))

const installFakeServices = () => {
  vi.mocked(getAssociationSettingsService).mockImplementation(async () =>
    resolveSettings(
      ASSOCIATION_SETTINGS_REGISTRY,
      settingRows.current as AssociationSettingRow[]
    )
  )
  vi.mocked(getOrganizationByIdService).mockResolvedValue({
    id: ORG_ID,
  } as Awaited<ReturnType<typeof getOrganizationByIdService>>)

  vi.mocked(findMemberProfileIdByPennylaneIdService).mockImplementation(
    async (_organizationId, customerId) => db.profiles.get(customerId)
  )

  vi.mocked(createMemberProfileService).mockImplementation(async (input) => {
    const email = input.email?.toLowerCase()
    const holder = email ? db.accounts.get(email) : undefined
    if (holder && input.confirmedAccountUserId !== holder) {
      return {
        status: 'email_shared',
        holder: {userId: holder, name: 'Compte existant', profiles: []},
      }
    }
    for (const field of ['homePostalCode', 'landPostalCode'] as const) {
      const value = input[field]
      if (value && !/^\d{5}$/.test(value)) {
        const parsed = z
          .object({[field]: z.string().regex(/^\d{5}$/)})
          .safeParse({[field]: value})
        throw new ValidationParsedZodError(parsed.error)
      }
    }
    const id = `fiche-${input.pennylaneCustomerId}`
    db.pending.push(`profile:${id}`)
    db.profiles.set(input.pennylaneCustomerId ?? '', id)
    if (email && !holder) db.accounts.set(email, `compte-${id}`)
    return {
      status: 'saved',
      accountChange: holder ? 'linked' : email ? 'opened' : null,
      profile: {id, mailOnly: !input.email},
    } as Awaited<ReturnType<typeof createMemberProfileService>>
  })

  vi.mocked(addMemberProfileEmailService).mockImplementation(async (input) => {
    const email = input.email.toLowerCase()
    const holder = db.accounts.get(email)
    if (holder && input.confirmedAccountUserId !== holder) {
      return {
        status: 'email_shared',
        holder: {userId: holder, name: 'Compte existant', profiles: []},
      }
    }
    db.pending.push(`email:${input.memberProfileId}:${email}`)
    if (!holder) db.accounts.set(email, `compte-${input.memberProfileId}`)
    return {
      status: 'saved',
      change: 'added',
      email,
    } as Awaited<ReturnType<typeof addMemberProfileEmailService>>
  })

  vi.mocked(attachParcelService).mockImplementation(async (input) => {
    const owner = db.owners.get(input.parcelNumber)
    if (owner) {
      return {
        status: 'overlap',
        parcelNumber: input.parcelNumber,
        conflict: {
          memberProfileId: owner,
          name: '',
          startsOn: OWNERSHIP_BEFORE_IMPORT_DATE,
          endsOn: null,
        },
      }
    }
    db.pending.push(`parcel:${input.parcelNumber}`)
    db.owners.set(input.parcelNumber, input.memberProfileId)
    return {
      status: 'attached',
      parcelId: `p-${input.parcelNumber}`,
      parcelNumber: input.parcelNumber,
      parcelCreated: true,
    }
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  db.scope = undefined
  db.pending = []
  db.committed = []
  db.profiles = new Map()
  db.owners = new Map()
  db.accounts = new Map([['pris@exemple.test', 'compte-existant']])
  settingRows.current = []
  installFakeServices()
})

describe('[SUPER_ADMIN] importMembersService', () => {
  beforeEach(() => {
    setupAuthUserMocked(userTestSuperAdmin)
  })

  it('crée membres, comptes et parcelles dans le tenant visé (critères 2, 4, 5)', async () => {
    const report = await run()

    expect(report).toMatchObject({
      linesRead: 6,
      membersCreated: 4,
      accountsOpened: 2,
      mailOnlyMembers: 1,
      parcelsAttached: 5,
      linesRejected: 1,
      alreadyPresent: 0,
    })
    expect(db.committed).toEqual([
      'profile:fiche-c-001',
      'parcel:ZZ 101',
      'parcel:ZZ 102',
      'profile:fiche-c-002',
      'parcel:ZZ 103',
      'profile:fiche-c-004',
      'parcel:ZZ 105',
      'profile:fiche-c-005',
      'parcel:ZZ 106',
    ])
  })

  it('passe l’identifiant Pennylane, la date sentinelle et le compteur aux services', async () => {
    await run()

    expect(createMemberProfileService).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      name: 'Lucie Fictive',
      email: 'lucie@exemple.test',
      homeAddressLine: '1 allée des Essais',
      homePostalCode: '99100',
      homeCity: 'Fictiville',
      pennylaneCustomerId: 'c-001',
    })
    expect(attachParcelService).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      memberProfileId: 'fiche-c-001',
      parcelNumber: 'ZZ 101',
      meterNumber: '00XX000001',
      startsOn: OWNERSHIP_BEFORE_IMPORT_DATE,
    })
  })

  it('liste les rejets ligne à ligne sans arrêter les suivantes (critères 3 et 6)', async () => {
    const report = await run()

    expect(report.rejections).toEqual([
      {line: 5, client: 'Sans Contact', reason: 'no_contact'},
    ])
    expect(db.profiles.get('c-005')).toBe('fiche-c-005')
  })

  it('relancer le même fichier ne crée rien (critère 7)', async () => {
    await run()
    const committedAfterFirstRun = [...db.committed]

    const report = await run()

    expect(db.committed).toEqual(committedAfterFirstRun)
    expect(report).toMatchObject({
      membersCreated: 0,
      accountsOpened: 0,
      mailOnlyMembers: 0,
      parcelsAttached: 0,
      alreadyPresent: 4,
      linesRejected: 1,
    })
    expect(
      report.remarks.filter(({remark}) => remark.startsWith('shared_email'))
    ).toEqual([])
  })

  it('n’écrit rien pour une ligne dont la parcelle appartient à un autre membre', async () => {
    db.owners.set('ZZ 102', 'fiche-tierce')

    const report = await run()

    expect(report.rejections).toContainEqual({
      line: 3,
      client: 'Lucie Fictive',
      reason: 'parcel_taken',
    })
    expect(db.committed).not.toContain('profile:fiche-c-001')
    expect(db.committed).not.toContain('parcel:ZZ 101')
    expect(report.membersCreated).toBe(3)
  })

  it('traduit une erreur de validation en motif (code postal non valide)', async () => {
    const report = await run(
      csv(
        line({
          id: 'c-010',
          name: 'Code Faux',
          address: '1 rue Fictive',
          postalCode: 'A9999',
          reference: 'ZZ 110 - 00XX000010',
        })
      )
    )

    expect(report.rejections).toEqual([
      {line: 2, client: 'Code Faux', reason: 'invalid_postal_code'},
    ])
    expect(db.committed).toEqual([])
  })

  it('ne journalise que des comptages, jamais une donnée de ligne', async () => {
    await run()

    const logged = JSON.stringify(
      Object.values(logger).flatMap(
        (method) => vi.mocked(method as () => void).mock.calls
      )
    )
    expect(logged).not.toContain('Lucie')
    expect(logged).not.toContain('exemple.test')
    expect(logged).not.toContain('ZZ 101')
  })

  it('refuse un fichier illisible avant tout traitement', async () => {
    const result = await importMembersService({
      organizationId: ORG_ID,
      content: new Uint8Array(),
    })

    expect(result).toEqual({status: 'file_refused', reason: 'empty'})
    expect(createMemberProfileService).not.toHaveBeenCalled()
  })

  it('refuse un fichier sans les colonnes attendues, en les nommant', async () => {
    const result = await importMembersService({
      organizationId: ORG_ID,
      content: new TextEncoder().encode('Nom;Ville\nLucie;Fictiville\n'),
    })

    expect(result).toMatchObject({
      status: 'file_refused',
      reason: 'missing_columns',
    })
    expect(createMemberProfileService).not.toHaveBeenCalled()
  })

  it('refuse un fichier au-delà du plafond de lignes, avant tout traitement', async () => {
    const lines = Array.from({length: MEMBER_IMPORT_MAX_LINES + 1}, (_, i) =>
      line({id: `c-${i}`, name: `Membre ${i}`, email: `m${i}@exemple.test`})
    )

    const result = await importMembersService({
      organizationId: ORG_ID,
      content: csv(...lines),
    })

    expect(result).toEqual({
      status: 'file_refused',
      reason: 'too_many_lines',
      maxLines: MEMBER_IMPORT_MAX_LINES,
    })
    expect(createMemberProfileService).not.toHaveBeenCalled()
  })

  it('rend un statut dédié pour une association inconnue', async () => {
    vi.mocked(getOrganizationByIdService).mockResolvedValue(undefined)

    expect(
      await importMembersService({organizationId: ORG_ID, content: FILE})
    ).toEqual({status: 'organization_not_found'})
    expect(createMemberProfileService).not.toHaveBeenCalled()
  })
})

/**
 * s53, critere 5 : une adresse partagee n'est plus rejetee. Une fiche par
 * client Pennylane, toutes reliees au meme compte, et chaque regroupement
 * signale au rapport.
 */
describe('[SUPER_ADMIN] importMembersService — adresses partagées (s53)', () => {
  beforeEach(() => {
    setupAuthUserMocked(userTestSuperAdmin)
  })

  const SHARED = csv(
    line({
      id: 'p-001',
      name: 'Bernard Fictif',
      address: '3 chemin des Essais',
      email: 'bernard@exemple.test',
      reference: 'ZZ 201 - 00XX000201',
    }),
    line({
      id: 'p-002',
      name: 'SCI Fictive',
      address: '3 chemin des Essais',
      email: 'Bernard@Exemple.test',
      reference: 'ZZ 202 - 00XX000202',
    })
  )

  it('crée deux fiches reliées au même compte et signale le regroupement (critère 5)', async () => {
    const report = await run(SHARED)

    expect(db.committed).toEqual([
      'profile:fiche-p-001',
      'parcel:ZZ 201',
      'profile:fiche-p-002',
      'parcel:ZZ 202',
    ])
    expect(createMemberProfileService).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pennylaneCustomerId: 'p-002',
        confirmedAccountUserId: 'compte-fiche-p-001',
      })
    )
    expect(report).toMatchObject({
      membersCreated: 2,
      accountsOpened: 1,
      linesRejected: 0,
      rejections: [],
    })
    expect(report.remarks).toContainEqual({
      line: 3,
      client: 'SCI Fictive',
      remark: 'shared_email',
      relatedLine: 2,
    })
    expect(
      report.remarks.filter(({remark}) => remark.startsWith('shared_email'))
    ).toHaveLength(1)
  })

  it('signale une adresse déjà portée par une fiche existante, hors du fichier', async () => {
    const report = await run()

    expect(report.remarks).toContainEqual({
      line: 6,
      client: 'Nora Doublon',
      remark: 'shared_email_existing',
    })
  })

  it('relancer le fichier ne crée rien et ne signale plus de regroupement', async () => {
    await run(SHARED)
    const committed = [...db.committed]

    const report = await run(SHARED)

    expect(db.committed).toEqual(committed)
    expect(report).toMatchObject({membersCreated: 0, alreadyPresent: 2})
    expect(
      report.remarks.filter(({remark}) => remark.startsWith('shared_email'))
    ).toEqual([])
  })
})

describe.each([
  ['[ORGANIZATION OWNER]', withRole(UserOrganizationRoleConst.OWNER)],
  ['[USER]', userTest],
  ['[PUBLIC]', undefined],
])('%s importMembersService', (_label, user) => {
  beforeEach(() => {
    setupAuthUserMocked(user)
  })

  it('refuse l’import sans rien lire ni écrire', async () => {
    await expect(
      importMembersService({organizationId: ORG_ID, content: FILE})
    ).rejects.toThrow(AuthorizationError)
    expect(getOrganizationByIdService).not.toHaveBeenCalled()
    expect(createMemberProfileService).not.toHaveBeenCalled()
  })
})

/**
 * s54 (critere 11) : toutes les adresses d'une cellule sont reprises. La
 * premiere est la titulaire de la fiche creee, les suivantes ses
 * supplementaires, actives et d'origine fichier ; une adresse deja portee
 * par une autre fiche rejoint le meme compte, avec le role de la cellule
 * (critere 8).
 */
describe('[SUPER_ADMIN] importMembersService — plusieurs adresses par cellule (s54)', () => {
  beforeEach(() => {
    setupAuthUserMocked(userTestSuperAdmin)
  })

  it('cellule à trois adresses : la première titulaire, les deux suivantes supplémentaires, origine fichier', async () => {
    await run(
      csv(
        line({
          id: 'c-010',
          name: 'Jean Dubois',
          address: '21 allée des Essais',
          email: 'jean@exemple.test, claire@exemple.test marc@exemple.test',
          reference: 'ZZ 121 - 00XX000021',
        })
      )
    )

    expect(createMemberProfileService).toHaveBeenCalledWith(
      expect.objectContaining({email: 'jean@exemple.test'})
    )
    expect(
      vi.mocked(addMemberProfileEmailService).mock.calls.map(([input]) => ({
        email: input.email,
        role: input.role,
        origin: input.origin,
        memberProfileId: input.memberProfileId,
      }))
    ).toEqual([
      {
        email: 'claire@exemple.test',
        role: 'additional',
        origin: 'file',
        memberProfileId: 'fiche-c-010',
      },
      {
        email: 'marc@exemple.test',
        role: 'additional',
        origin: 'file',
        memberProfileId: 'fiche-c-010',
      },
    ])
    expect(db.committed).toEqual(
      expect.arrayContaining([
        'email:fiche-c-010:claire@exemple.test',
        'email:fiche-c-010:marc@exemple.test',
      ])
    )
  })

  it('adresse titulaire d’une fiche et supplémentaire d’une autre : un seul compte, le rôle de chaque cellule (critère 8)', async () => {
    await run(
      csv(
        line({
          id: 'c-020',
          name: 'Bernard Lefèvre',
          address: '12 allée des Essais',
          email: 'bernard@exemple.test',
          reference: 'ZZ 112 - 00XX000012',
        }),
        line({
          id: 'c-021',
          name: 'SCI Les Pins',
          address: '27 allée des Essais',
          email: 'sci@exemple.test, Bernard@exemple.test',
          reference: 'ZZ 127 - 00XX000027',
        })
      )
    )

    const sharedAdd = vi
      .mocked(addMemberProfileEmailService)
      .mock.calls.map(([input]) => input)
      .filter((input) => input.email.toLowerCase() === 'bernard@exemple.test')
    expect(sharedAdd.at(-1)).toMatchObject({
      memberProfileId: 'fiche-c-021',
      role: 'additional',
      origin: 'file',
      confirmedAccountUserId: 'compte-fiche-c-020',
    })
    expect(db.committed).toEqual(
      expect.arrayContaining(['email:fiche-c-021:bernard@exemple.test'])
    )
  })

  it('un membre déjà importé garde ses adresses : l’ordre de la cellule ne déplace pas le titre (critère 9)', async () => {
    db.profiles.set('c-030', 'fiche-existante')

    await run(
      csv(
        line({
          id: 'c-030',
          name: 'Déjà Là',
          address: '30 allée des Essais',
          email: 'autre@exemple.test, deja@exemple.test',
          reference: 'ZZ 130 - 00XX000030',
        })
      )
    )

    expect(createMemberProfileService).not.toHaveBeenCalled()
    expect(addMemberProfileEmailService).not.toHaveBeenCalled()
  })
})

/** Un export avec les colonnes de livraison et le type de client (s55). */
const S55_HEADER = `${HEADER};Adresse de Livraison;Code Postal de Livraison;Ville de Livraison;Pays de Livraison;Type de Client`

const s55Line = (fields: {
  id: string
  name: string
  address?: string
  postalCode?: string
  delivery?: string
  deliveryPostalCode?: string
  clientType?: string
  reference: string
}) =>
  [
    fields.id,
    fields.name,
    fields.address ?? '',
    fields.postalCode ?? (fields.address ? '99100' : ''),
    fields.address ? 'Fictiville' : '',
    'FR',
    '',
    '',
    fields.reference,
    fields.delivery ?? '',
    fields.deliveryPostalCode ?? (fields.delivery ? '99200' : ''),
    fields.delivery ? 'Domicileville' : '',
    fields.delivery ? 'FR' : '',
    fields.clientType ?? 'Particulier',
  ].join(';')

const s55Csv = (...lines: string[]) =>
  new TextEncoder().encode([S55_HEADER, ...lines].join('\n'))

describe('[SUPER_ADMIN] importMembersService — domicile, terrain et entreprise (s55, ADR 058)', () => {
  const DEFAULT_LAND = [
    {key: MEMBER_DEFAULT_LAND_POSTAL_CODE_SETTING_KEY, value: '33680'},
    {key: MEMBER_DEFAULT_LAND_CITY_SETTING_KEY, value: 'Lacanau'},
  ]

  beforeEach(() => {
    setupAuthUserMocked(userTestSuperAdmin)
  })

  it('une fiche créée sans terrain reçoit le code postal et la commune du terrain par défaut, sans rue', async () => {
    settingRows.current = DEFAULT_LAND

    await run(
      s55Csv(
        s55Line({
          id: 'c-020',
          name: 'Lucie Fictive',
          address: '1 allée des Essais',
          reference: 'ZZ 120 - 00XX000020',
        })
      )
    )

    const [input] = vi.mocked(createMemberProfileService).mock.calls[0]
    expect(input).toMatchObject({
      homeAddressLine: '1 allée des Essais',
      landPostalCode: '33680',
      landCity: 'Lacanau',
    })
    expect(input.landAddressLine).toBeUndefined()
    expect(getAssociationSettingsService).toHaveBeenCalledTimes(1)
    expect(getAssociationSettingsService).toHaveBeenCalledWith(ORG_ID)
  })

  it('lit les réglages une seule fois par import', async () => {
    settingRows.current = DEFAULT_LAND

    await run()

    expect(getAssociationSettingsService).toHaveBeenCalledTimes(1)
    expect(createMemberProfileService).toHaveBeenCalledWith(
      expect.objectContaining({landPostalCode: '33680', landCity: 'Lacanau'})
    )
  })

  it('sans réglage, le terrain d’une fiche créée reste vide', async () => {
    await run(
      s55Csv(
        s55Line({
          id: 'c-021',
          name: 'Lucie Fictive',
          address: '1 allée des Essais',
          reference: 'ZZ 121 - 00XX000021',
        })
      )
    )

    const [input] = vi.mocked(createMemberProfileService).mock.calls[0]
    expect(input.landAddressLine).toBeUndefined()
    expect(input.landPostalCode).toBeUndefined()
    expect(input.landCity).toBeUndefined()
  })

  it('le terrain du fichier l’emporte sur le terrain par défaut', async () => {
    settingRows.current = DEFAULT_LAND

    await run(
      s55Csv(
        s55Line({
          id: 'c-022',
          name: 'Lucie Fictive',
          address: '1 allée des Essais',
          delivery: '8 rue du Domicile',
          reference: 'ZZ 122 - 00XX000022',
        })
      )
    )

    expect(createMemberProfileService).toHaveBeenCalledWith(
      expect.objectContaining({
        homeAddressLine: '8 rue du Domicile',
        homePostalCode: '99200',
        homeCity: 'Domicileville',
        landAddressLine: '1 allée des Essais',
        landPostalCode: '99100',
        landCity: 'Fictiville',
      })
    )
  })

  it('passe le nom de l’entreprise d’un client entreprise', async () => {
    await run(
      s55Csv(
        s55Line({
          id: 'c-023',
          name: 'Épicerie Fictive',
          address: '1 allée des Essais',
          clientType: 'Entreprise',
          reference: 'ZZ 123 - 00XX000023',
        })
      )
    )

    expect(createMemberProfileService).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Épicerie Fictive',
        companyName: 'Épicerie Fictive',
      })
    )
  })

  it('une fiche déjà présente n’est pas touchée : ni création ni terrain par défaut', async () => {
    settingRows.current = DEFAULT_LAND
    db.profiles.set('c-024', 'fiche-existante')

    const report = await run(
      s55Csv(
        s55Line({
          id: 'c-024',
          name: 'Lucie Fictive',
          address: '1 allée des Essais',
          reference: 'ZZ 124 - 00XX000024',
        })
      )
    )

    expect(report.alreadyPresent).toBe(1)
    expect(createMemberProfileService).not.toHaveBeenCalled()
  })

  it('traduit un code postal du terrain non valide en motif', async () => {
    const report = await run(
      s55Csv(
        s55Line({
          id: 'c-025',
          name: 'Terrain Faux',
          address: '1 rue Fictive',
          postalCode: 'A9999',
          delivery: '8 rue du Domicile',
          reference: 'ZZ 125 - 00XX000025',
        })
      )
    )

    expect(report.rejections).toEqual([
      {line: 2, client: 'Terrain Faux', reason: 'invalid_postal_code'},
    ])
  })
})

describe('[SUPER_ADMIN] instantané de la fiche créée (s56, ADR 077)', () => {
  beforeEach(() => {
    setupAuthUserMocked(userTestSuperAdmin)
  })

  it('écrit, à la création, les valeurs lues dans le fichier, terrain écrit compris', async () => {
    settingRows.current = [
      {key: MEMBER_DEFAULT_LAND_POSTAL_CODE_SETTING_KEY, value: '99500'},
      {key: MEMBER_DEFAULT_LAND_CITY_SETTING_KEY, value: 'Terrainville'},
    ]

    await run()

    expect(setMemberProfileImportSnapshotDao).toHaveBeenCalledWith(
      'fiche-c-001',
      {
        snapshot: {
          home: {
            line: '1 allée des Essais',
            postalCode: '99100',
            city: 'Fictiville',
          },
          land: {line: null, postalCode: '99500', city: 'Terrainville'},
          phone: null,
          emails: ['lucie@exemple.test'],
        },
        importedAt: expect.any(Date),
      }
    )
    expect(setMemberProfileImportSnapshotDao).not.toHaveBeenCalledWith(
      'fiche-c-003',
      expect.anything()
    )
  })

  it('une fiche déjà présente ne reçoit pas d’instantané de l’import initial', async () => {
    db.profiles.set('c-001', 'fiche-existante')

    await run()

    expect(setMemberProfileImportSnapshotDao).not.toHaveBeenCalledWith(
      'fiche-existante',
      expect.anything()
    )
  })
})
