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
vi.mock('../parcel-ownership-service', () => ({
  attachParcelService: vi.fn(),
}))
vi.mock('../organization-service', () => ({
  getOrganizationByIdService: vi.fn(),
}))

import {z} from 'zod'

import {logger} from '@/lib/logger'

import {AuthorizationError} from '../errors/authorization-error'
import {ValidationParsedZodError} from '../errors/validation-error'
import {importMembersService} from '../member-import-service'
import {
  createMemberProfileService,
  findMemberProfileIdByPennylaneIdService,
} from '../member-profile-service'
import {getOrganizationByIdService} from '../organization-service'
import {attachParcelService} from '../parcel-ownership-service'
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
  // Ligne 6 : email deja porte par une autre fiche
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

const installFakeServices = () => {
  vi.mocked(getOrganizationByIdService).mockResolvedValue({
    id: ORG_ID,
  } as Awaited<ReturnType<typeof getOrganizationByIdService>>)

  vi.mocked(findMemberProfileIdByPennylaneIdService).mockImplementation(
    async (_organizationId, customerId) => db.profiles.get(customerId)
  )

  vi.mocked(createMemberProfileService).mockImplementation(async (input) => {
    if (input.email === 'pris@exemple.test') {
      return {status: 'email_taken', memberProfileId: 'autre-fiche'}
    }
    if (input.postalCode && !/^\d{5}$/.test(input.postalCode)) {
      const parsed = z
        .object({postalCode: z.string().regex(/^\d{5}$/)})
        .safeParse({postalCode: input.postalCode})
      throw new ValidationParsedZodError(parsed.error)
    }
    const id = `fiche-${input.pennylaneCustomerId}`
    db.pending.push(`profile:${id}`)
    db.profiles.set(input.pennylaneCustomerId ?? '', id)
    return {
      status: 'saved',
      accountChange: input.email ? 'opened' : null,
      profile: {id, mailOnly: !input.email},
    } as Awaited<ReturnType<typeof createMemberProfileService>>
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
      membersCreated: 3,
      accountsOpened: 2,
      mailOnlyMembers: 1,
      parcelsAttached: 4,
      linesRejected: 2,
      alreadyPresent: 0,
    })
    expect(db.committed).toEqual([
      'profile:fiche-c-001',
      'parcel:ZZ 101',
      'parcel:ZZ 102',
      'profile:fiche-c-002',
      'parcel:ZZ 103',
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
      addressLine: '1 allée des Essais',
      postalCode: '99100',
      city: 'Fictiville',
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
      {line: 6, client: 'Nora Doublon', reason: 'email_taken'},
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
      alreadyPresent: 3,
      linesRejected: 2,
    })
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
    expect(report.membersCreated).toBe(2)
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
