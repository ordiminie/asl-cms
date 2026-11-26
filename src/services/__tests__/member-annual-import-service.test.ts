import {beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * Base simulee de la mise a jour annuelle (s56) : des fiches, leurs adresses
 * et les roles de leurs comptes. Chaque `withTenant` racine est une
 * transaction : une erreur restaure l'etat d'avant la fiche. Les services
 * appeles sont des fakes qui ecrivent dans cette base, et chaque ecriture est
 * journalisee dans `writes`.
 */
type FakeEmail = {
  id: string
  memberProfileId: string
  email: string
  role: 'holder' | 'additional'
  status: 'active' | 'pending' | 'disabled_by_import'
  origin: 'file' | 'site'
  addedByUserId: string | null
  replacesEmailId: string | null
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
}

type FakeProfile = {
  id: string
  organizationId: string
  name: string
  pennylaneCustomerId: string | null
  phone: string | null
  homeAddressLine: string | null
  homeAddressComplement: string | null
  homePostalCode: string | null
  homeCity: string | null
  landAddressLine: string | null
  landAddressComplement: string | null
  landPostalCode: string | null
  landCity: string | null
  companyName: string | null
  pennylaneImportSnapshot: unknown
  pennylaneImportedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

type FakeState = {
  profiles: FakeProfile[]
  emails: FakeEmail[]
  /** Role d'association de chaque compte (par adresse). */
  roles: Record<string, 'member' | 'board' | 'owner'>
}

const db = vi.hoisted(() => ({
  state: {profiles: [], emails: [], roles: {}} as unknown as FakeState,
  writes: [] as string[],
  inScope: false,
  sequence: 0,
}))

vi.mock('@/db/tenant-scope', () => ({
  withTenant: vi.fn(
    async (_organizationId: string, callback: () => unknown) => {
      if (db.inScope) return callback()
      const saved = structuredClone(db.state)
      const savedWrites = [...db.writes]
      db.inScope = true
      try {
        return await callback()
      } catch (error) {
        db.state = saved
        db.writes = savedWrites
        throw error
      } finally {
        db.inScope = false
      }
    }
  ),
}))
vi.mock('@/db/repositories/member-profile-repository', () => ({
  getLinkedAccountsDao: vi.fn(),
  getMemberProfileByIdDao: vi.fn(),
  listMemberProfilesByPennylaneIdIgnoringCaseDao: vi.fn(),
  setMemberProfileImportSnapshotDao: vi.fn(),
}))
vi.mock('@/db/repositories/member-profile-email-repository', () => ({
  getMemberProfileEmailsDao: vi.fn(),
}))
vi.mock('../member-account-service', () => ({
  getLinkedAccountRole: vi.fn(),
}))
vi.mock('../member-profile-service', () => ({
  updateMemberProfileContactService: vi.fn(),
}))
vi.mock('../member-profile-email-service', () => ({
  addMemberProfileEmailService: vi.fn(),
  designateMemberProfileHolderService: vi.fn(),
  disableImportedEmail: vi.fn(),
  reactivateImportedEmail: vi.fn(),
}))
vi.mock('../parcel-ownership-service', () => ({
  attachParcelService: vi.fn(),
  recordSaleService: vi.fn(),
}))
vi.mock('../association-settings-service', () => ({
  getAssociationSettingsService: vi.fn(),
}))

import {z} from 'zod'

import {getMemberProfileEmailsDao} from '@/db/repositories/member-profile-email-repository'
import {
  getLinkedAccountsDao,
  getMemberProfileByIdDao,
  listMemberProfilesByPennylaneIdIgnoringCaseDao,
  setMemberProfileImportSnapshotDao,
} from '@/db/repositories/member-profile-repository'
import {withTenant} from '@/db/tenant-scope'
import {logger} from '@/lib/logger'

import {getAssociationSettingsService} from '../association-settings-service'
import {AuthorizationError} from '../errors/authorization-error'
import {ValidationParsedZodError} from '../errors/validation-error'
import {getLinkedAccountRole} from '../member-account-service'
import {
  canImportMemberContactsService,
  importAnnualMemberContactsService,
} from '../member-annual-import-service'
import {
  addMemberProfileEmailService,
  designateMemberProfileHolderService,
  disableImportedEmail,
  reactivateImportedEmail,
} from '../member-profile-email-service'
import {updateMemberProfileContactService} from '../member-profile-service'
import {
  attachParcelService,
  recordSaleService,
} from '../parcel-ownership-service'
import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import {AnnualImportReportDTO} from '../types/domain/member-annual-import-types'
import {MEMBER_IMPORT_MAX_LINES} from '../types/domain/member-import-types'
import {OrganizationRole} from '../types/domain/organization-types'
import {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest, userTestSuperAdmin} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const CREATED = new Date('2026-01-10T10:00:00Z')
const LATER = new Date('2026-06-10T10:00:00Z')

const HEADER = [
  'Identifiant Client',
  'Dénomination',
  'Adresse',
  'Code Postal',
  'Ville',
  'Pays',
  'Liste d’e-mails',
  'Téléphone',
  'Adresse de Livraison',
  'Code Postal de Livraison',
  'Ville de Livraison',
  'Pays de Livraison',
  'Type de Client',
].join(';')

type Line = {
  id: string
  name?: string
  address?: string
  postalCode?: string
  city?: string
  emails?: string
  phone?: string
  delivery?: string
  deliveryPostalCode?: string
  deliveryCity?: string
  clientType?: string
}

const line = (fields: Line) =>
  [
    fields.id,
    fields.name ?? `Client ${fields.id}`,
    fields.address ?? '',
    fields.postalCode ?? (fields.address ? '99100' : ''),
    fields.city ?? (fields.address ? 'Fictiville' : ''),
    'FR',
    fields.emails ?? '',
    fields.phone ?? '',
    fields.delivery ?? '',
    fields.deliveryPostalCode ?? (fields.delivery ? '99200' : ''),
    fields.deliveryCity ?? (fields.delivery ? 'Domicileville' : ''),
    fields.delivery ? 'FR' : '',
    fields.clientType ?? '',
  ].join(';')

const csv = (...lines: string[]) =>
  new TextEncoder().encode([HEADER, ...lines].join('\n'))

const withRole = (role: OrganizationRole, organizationId = ORG_ID): User => ({
  ...userTest,
  organizations: [
    {
      id: 'membership',
      organizationId,
      userId: userTest.id,
      role,
      createdAt: new Date(),
    },
  ],
})

const president = withRole(UserOrganizationRoleConst.OWNER)

const profile = (
  id: string,
  overrides: Partial<FakeProfile> = {}
): FakeProfile => ({
  id,
  organizationId: ORG_ID,
  name: `Fiche ${id}`,
  pennylaneCustomerId: id,
  phone: null,
  homeAddressLine: '1 allée des Essais',
  homeAddressComplement: 'Bâtiment B',
  homePostalCode: '99100',
  homeCity: 'Fictiville',
  landAddressLine: null,
  landAddressComplement: null,
  landPostalCode: null,
  landCity: null,
  companyName: null,
  pennylaneImportSnapshot: null,
  pennylaneImportedAt: null,
  createdAt: CREATED,
  updatedAt: CREATED,
  ...overrides,
})

const address = (
  memberProfileId: string,
  email: string,
  overrides: Partial<FakeEmail> = {}
): FakeEmail => ({
  id: `${memberProfileId}:${email}`,
  memberProfileId,
  email,
  role: 'additional',
  status: 'active',
  origin: 'file',
  addedByUserId: null,
  replacesEmailId: null,
  expiresAt: null,
  createdAt: CREATED,
  updatedAt: CREATED,
  ...overrides,
})

const snapshotOf = (emails: string[], overrides: object = {}) => ({
  home: {line: '1 allée des Essais', postalCode: '99100', city: 'Fictiville'},
  land: null,
  phone: null,
  emails,
  ...overrides,
})

const given = (state: Partial<FakeState>) => {
  db.state = {profiles: [], emails: [], roles: {}, ...state}
}

const profileOf = (id: string) =>
  db.state.profiles.find((candidate) => candidate.id === id)

const emailsOf = (memberProfileId: string) =>
  db.state.emails
    .filter((row) => row.memberProfileId === memberProfileId)
    .map(({email, role, status, origin}) => ({email, role, status, origin}))

const touch = (row: {updatedAt: Date}) => {
  row.updatedAt = new Date(row.updatedAt.getTime() + 60_000)
}

const isActive = (row: FakeEmail) => row.status === 'active'

const holderOf = (memberProfileId: string) =>
  db.state.emails.find(
    (row) =>
      row.memberProfileId === memberProfileId &&
      isActive(row) &&
      row.role === 'holder'
  )

const installFakes = () => {
  vi.mocked(listMemberProfilesByPennylaneIdIgnoringCaseDao).mockImplementation(
    async (_organizationId, customerId) =>
      db.state.profiles
        .filter(
          (candidate) =>
            candidate.pennylaneCustomerId?.toLowerCase() ===
            customerId.toLowerCase()
        )
        .map(({id, name}) => ({id, name}))
  )
  vi.mocked(getMemberProfileByIdDao).mockImplementation(async (id) => {
    const row = profileOf(id)
    if (!row) return undefined
    return {
      ...row,
      email: holderOf(id)?.email ?? null,
      mailOnly: !db.state.emails.some(
        (email) => email.memberProfileId === id && isActive(email)
      ),
    } as never
  })
  vi.mocked(getMemberProfileEmailsDao).mockImplementation(
    async (ids) =>
      db.state.emails
        .filter((row) => ids.includes(row.memberProfileId))
        .map((row) => ({...row, addedByName: null})) as never
  )
  vi.mocked(getLinkedAccountsDao).mockImplementation(async (id) =>
    db.state.emails
      .filter((row) => row.memberProfileId === id && isActive(row))
      .map((row) => ({
        userId: `user:${row.email}`,
        email: row.email,
        name: row.email,
      }))
  )
  vi.mocked(getLinkedAccountRole).mockImplementation(
    async (_organizationId, userId) =>
      userId ? (db.state.roles[userId.replace('user:', '')] ?? 'member') : null
  )
  vi.mocked(setMemberProfileImportSnapshotDao).mockImplementation(
    async (id, {snapshot, importedAt}) => {
      const row = profileOf(id)
      if (row) {
        row.pennylaneImportSnapshot = snapshot
        row.pennylaneImportedAt = importedAt
      }
    }
  )
  vi.mocked(updateMemberProfileContactService).mockImplementation(
    async ({memberProfileId, ...input}) => {
      const contact = Object.fromEntries(
        Object.entries(input).filter(([key]) => key !== 'organizationId')
      ) as Record<string, string | undefined>
      for (const field of ['homePostalCode', 'landPostalCode'] as const) {
        const value = contact[field]
        if (value && !/^\d{5}$/.test(value)) {
          const parsed = z
            .object({[field]: z.string().regex(/^\d{5}$/)})
            .safeParse({[field]: value})
          throw new ValidationParsedZodError(parsed.error)
        }
      }
      const row = profileOf(memberProfileId)
      if (!row) return {status: 'not_found'}
      Object.assign(
        row,
        Object.fromEntries(
          Object.entries(contact).map(([key, value]) => [key, value || null])
        )
      )
      touch(row)
      db.writes.push(`contact:${memberProfileId}`)
      return {status: 'saved', profile: {} as never, accountChange: null}
    }
  )
  vi.mocked(addMemberProfileEmailService).mockImplementation(async (input) => {
    const rows = db.state.emails.filter(
      (row) => row.memberProfileId === input.memberProfileId
    )
    const holder = holderOf(input.memberProfileId)
    const role = !rows.some(isActive)
      ? 'holder'
      : input.role === 'holder'
        ? 'holder'
        : 'additional'
    if (role === 'holder' && holder) holder.role = 'additional'
    db.sequence += 1
    db.state.emails.push(
      address(input.memberProfileId, input.email, {
        role,
        origin: input.origin ?? 'site',
        createdAt: new Date(LATER.getTime() + db.sequence),
        updatedAt: new Date(LATER.getTime() + db.sequence),
      })
    )
    db.writes.push(`email:add:${input.memberProfileId}:${input.email}:${role}`)
    return {status: 'saved', change: 'added', email: input.email} as never
  })
  vi.mocked(disableImportedEmail).mockImplementation(async ({emailId}) => {
    const row = db.state.emails.find((candidate) => candidate.id === emailId)
    if (!row) return {status: 'not_found'}
    const role = db.state.roles[row.email]
    if (role && role !== 'member') return {status: 'board_email_required'}
    row.status = 'disabled_by_import'
    row.role = 'additional'
    touch(row)
    db.writes.push(`email:disable:${row.email}`)
    return {status: 'disabled'}
  })
  vi.mocked(reactivateImportedEmail).mockImplementation(
    async ({emailId, role}) => {
      const row = db.state.emails.find((candidate) => candidate.id === emailId)
      if (!row) return {status: 'not_found'}
      const others = db.state.emails.filter(
        (candidate) =>
          candidate.memberProfileId === row.memberProfileId &&
          candidate.id !== row.id
      )
      const next =
        !others.some(isActive) || role === 'holder' ? 'holder' : 'additional'
      row.status = 'active'
      row.role = next
      touch(row)
      db.writes.push(`email:reactivate:${row.email}:${next}`)
      return {status: 'reactivated', role: next}
    }
  )
  vi.mocked(designateMemberProfileHolderService).mockImplementation(
    async ({memberProfileId, emailId}) => {
      const holder = holderOf(memberProfileId)
      if (holder) holder.role = 'additional'
      const row = db.state.emails.find((candidate) => candidate.id === emailId)
      if (row) row.role = 'holder'
      db.writes.push(`email:designate:${row?.email}`)
      return {status: 'saved', change: 'designated', email: row?.email} as never
    }
  )
}

const run = async (content: Uint8Array): Promise<AnnualImportReportDTO> => {
  const result = await importAnnualMemberContactsService({
    organizationId: ORG_ID,
    content,
  })
  if (result.status !== 'imported') {
    throw new Error(`import refuse : ${result.status}`)
  }
  return result.report
}

beforeEach(() => {
  vi.clearAllMocks()
  db.writes = []
  db.inScope = false
  db.sequence = 0
  given({})
  installFakes()
  setupAuthUserMocked(president)
})

describe('importAnnualMemberContactsService — autorisation (critère 1)', () => {
  it('[ORGANIZATION BOARD] le Bureau est refusé à l’appel direct, aucun DAO appelé', async () => {
    setupAuthUserMocked(withRole(UserOrganizationRoleConst.ADMIN))

    await expect(
      importAnnualMemberContactsService({
        organizationId: ORG_ID,
        content: csv(line({id: 'c-1', address: '1 rue'})),
      })
    ).rejects.toThrow(AuthorizationError)
    expect(
      listMemberProfilesByPennylaneIdIgnoringCaseDao
    ).not.toHaveBeenCalled()
    expect(withTenant).not.toHaveBeenCalled()
  })

  it('[PUBLIC] un visiteur est refusé', async () => {
    setupAuthUserMocked(undefined)

    await expect(
      importAnnualMemberContactsService({
        organizationId: ORG_ID,
        content: csv(line({id: 'c-1', address: '1 rue'})),
      })
    ).rejects.toThrow(AuthorizationError)
  })

  it('[OTHER ORGANIZATION OWNER] la présidente d’une autre association est refusée', async () => {
    setupAuthUserMocked(
      withRole(
        UserOrganizationRoleConst.OWNER,
        '22222222-2222-4222-8222-222222222222'
      )
    )

    await expect(
      importAnnualMemberContactsService({
        organizationId: ORG_ID,
        content: csv(line({id: 'c-1', address: '1 rue'})),
      })
    ).rejects.toThrow(AuthorizationError)
  })

  it.each([
    ['[ORGANIZATION OWNER] la présidente', president],
    ['[SUPER_ADMIN] le SuperAdmin', userTestSuperAdmin],
  ])('%s est acceptée, dans le tenant visé', async (_, user) => {
    setupAuthUserMocked(user)

    const report = await run(csv(line({id: 'c-1', address: '1 rue'})))

    expect(report.linesRead).toBe(1)
    expect(withTenant).toHaveBeenCalledWith(ORG_ID, expect.any(Function))
  })

  it('canImportMemberContactsService : la présidente oui, le Bureau non', async () => {
    await expect(canImportMemberContactsService(ORG_ID)).resolves.toBe(true)
    setupAuthUserMocked(withRole(UserOrganizationRoleConst.ADMIN))
    await expect(canImportMemberContactsService(ORG_ID)).resolves.toBe(false)
  })
})

describe('importAnnualMemberContactsService — fichier refusé avant toute écriture', () => {
  it('colonne manquante : refus nommé, aucune fiche lue', async () => {
    const result = await importAnnualMemberContactsService({
      organizationId: ORG_ID,
      content: new TextEncoder().encode('Dénomination;Adresse\nA;B'),
    })

    expect(result).toMatchObject({
      status: 'file_refused',
      reason: 'missing_columns',
      missingColumns: expect.arrayContaining(['Identifiant Client']),
    })
    expect(
      listMemberProfilesByPennylaneIdIgnoringCaseDao
    ).not.toHaveBeenCalled()
  })

  it('trop de lignes : refus avec le plafond', async () => {
    const lines = Array.from(
      {length: MEMBER_IMPORT_MAX_LINES + 1},
      (_, index) => line({id: `c-${index}`, address: '1 rue'})
    )

    const result = await importAnnualMemberContactsService({
      organizationId: ORG_ID,
      content: csv(...lines),
    })

    expect(result).toMatchObject({
      status: 'file_refused',
      reason: 'too_many_lines',
      maxLines: MEMBER_IMPORT_MAX_LINES,
    })
    expect(withTenant).not.toHaveBeenCalled()
  })
})

describe('importAnnualMemberContactsService — coordonnées (critère 2, 6)', () => {
  it('rapproche par l’identifiant, sans casse, et met à jour domicile, terrain et téléphone', async () => {
    given({profiles: [profile('C-1')]})

    const report = await run(
      csv(
        line({
          id: 'c-1',
          address: '7 lot des Pins',
          postalCode: '99400',
          city: 'Terrainville',
          delivery: '9 rue du Domicile',
          phone: '06 00 00 00 09',
        })
      )
    )

    expect(profileOf('C-1')).toMatchObject({
      homeAddressLine: '9 rue du Domicile',
      homePostalCode: '99200',
      homeCity: 'Domicileville',
      homeAddressComplement: 'Bâtiment B',
      landAddressLine: '7 lot des Pins',
      landPostalCode: '99400',
      phone: '06 00 00 00 09',
    })
    expect(report.profilesUpdated).toBe(1)
    expect(report.updated).toEqual([
      {
        memberProfileId: 'C-1',
        name: 'Fiche C-1',
        groups: ['home', 'land', 'phone'],
      },
    ])
  })

  it('une valeur modifiée sur le site après le dernier import est gardée et signalée', async () => {
    given({
      profiles: [
        profile('c-1', {
          homeAddressLine: '3 chemin corrigé',
          pennylaneImportSnapshot: snapshotOf([]),
          updatedAt: LATER,
        }),
      ],
    })

    const report = await run(csv(line({id: 'c-1', address: '2 rue Neuve'})))

    expect(profileOf('c-1')?.homeAddressLine).toBe('3 chemin corrigé')
    expect(updateMemberProfileContactService).not.toHaveBeenCalled()
    expect(report.kept).toEqual([
      {
        memberProfileId: 'c-1',
        name: 'Fiche c-1',
        group: 'home',
        current: '3 chemin corrigé, 99100 Fictiville',
        file: '2 rue Neuve, 99100 Fictiville',
      },
    ])
    expect(report.profilesUnchanged).toBe(1)
  })

  it('le nom et l’entreprise ne sont jamais écrits ; le terrain par défaut n’est jamais lu (décision C)', async () => {
    given({profiles: [profile('c-1', {companyName: 'SCI Les Pins'})]})

    await run(
      csv(
        line({
          id: 'c-1',
          name: 'Autre Nom',
          address: '2 rue Neuve',
          clientType: 'Entreprise',
        })
      )
    )

    const [input] = vi.mocked(updateMemberProfileContactService).mock.calls[0]
    expect(input).not.toHaveProperty('name')
    expect(input.companyName).toBe('SCI Les Pins')
    expect(profileOf('c-1')?.name).toBe('Fiche c-1')
    expect(getAssociationSettingsService).not.toHaveBeenCalled()
  })

  it('écrit l’instantané et sa date à chaque fiche rapprochée', async () => {
    given({profiles: [profile('c-1')]})

    await run(csv(line({id: 'c-1', address: '2 rue Neuve', emails: 'A@x.fr'})))

    expect(setMemberProfileImportSnapshotDao).toHaveBeenCalledWith('c-1', {
      snapshot: {
        home: {line: '2 rue Neuve', postalCode: '99100', city: 'Fictiville'},
        land: null,
        phone: null,
        emails: ['a@x.fr'],
      },
      importedAt: expect.any(Date),
    })
  })
})

describe('importAnnualMemberContactsService — adresses email (critères 3 à 6, 9)', () => {
  it('critère 6 : toutes les adresses de la cellule sont ajoutées, origine fichier', async () => {
    given({profiles: [profile('c-1')]})

    await run(
      csv(
        line({
          id: 'c-1',
          address: '1 allée des Essais',
          emails: 'a@x.fr, b@x.fr',
        })
      )
    )

    expect(emailsOf('c-1')).toEqual([
      {email: 'a@x.fr', role: 'holder', status: 'active', origin: 'file'},
      {email: 'b@x.fr', role: 'additional', status: 'active', origin: 'file'},
    ])
    expect(addMemberProfileEmailService).toHaveBeenCalledWith(
      expect.objectContaining({organizationId: ORG_ID, origin: 'file'})
    )
  })

  it('critère 3 : la nouvelle adresse remplace la titulaire, l’ancienne n’est plus active', async () => {
    given({
      profiles: [
        profile('c-1', {
          pennylaneImportSnapshot: snapshotOf(['ancienne@x.fr']),
        }),
      ],
      emails: [address('c-1', 'ancienne@x.fr', {role: 'holder'})],
    })

    const report = await run(
      csv(
        line({
          id: 'c-1',
          address: '1 allée des Essais',
          emails: 'nouvelle@x.fr',
        })
      )
    )

    expect(emailsOf('c-1')).toEqual([
      {
        email: 'ancienne@x.fr',
        role: 'additional',
        status: 'disabled_by_import',
        origin: 'file',
      },
      {
        email: 'nouvelle@x.fr',
        role: 'holder',
        status: 'active',
        origin: 'file',
      },
    ])
    expect(report.replaced).toEqual([
      {
        memberProfileId: 'c-1',
        name: 'Fiche c-1',
        oldEmail: 'ancienne@x.fr',
        newEmail: 'nouvelle@x.fr',
      },
    ])
    expect(report.updated[0].groups).toEqual(['emails'])
  })

  it('critère 4 : titulaire absente sans remplaçante, le site en désigne une autre ; signalé au rapport', async () => {
    given({
      profiles: [
        profile('c-1', {
          pennylaneImportSnapshot: snapshotOf(['titulaire@x.fr', 'reste@x.fr']),
        }),
      ],
      emails: [
        address('c-1', 'titulaire@x.fr', {role: 'holder'}),
        address('c-1', 'reste@x.fr'),
      ],
    })

    const report = await run(
      csv(
        line({id: 'c-1', address: '1 allée des Essais', emails: 'reste@x.fr'})
      )
    )

    expect(holderOf('c-1')?.email).toBe('reste@x.fr')
    expect(report.designated).toEqual([
      {
        memberProfileId: 'c-1',
        name: 'Fiche c-1',
        oldEmail: 'titulaire@x.fr',
        newEmail: 'reste@x.fr',
      },
    ])
  })

  it('critère 5 : une supplémentaire du fichier précédent, absente, n’est plus active', async () => {
    given({
      profiles: [
        profile('c-1', {
          pennylaneImportSnapshot: snapshotOf(['titulaire@x.fr', 'extra@x.fr']),
        }),
      ],
      emails: [
        address('c-1', 'titulaire@x.fr', {role: 'holder'}),
        address('c-1', 'extra@x.fr'),
      ],
    })

    const report = await run(
      csv(
        line({
          id: 'c-1',
          address: '1 allée des Essais',
          emails: 'titulaire@x.fr',
        })
      )
    )

    expect(emailsOf('c-1')[1]).toMatchObject({
      email: 'extra@x.fr',
      status: 'disabled_by_import',
    })
    expect(report.disabled).toEqual([
      {memberProfileId: 'c-1', name: 'Fiche c-1', email: 'extra@x.fr'},
    ])
  })

  it('critère 9 : une adresse ajoutée sur le site reste active', async () => {
    given({
      profiles: [
        profile('c-1', {
          pennylaneImportSnapshot: snapshotOf(['titulaire@x.fr']),
        }),
      ],
      emails: [
        address('c-1', 'titulaire@x.fr', {role: 'holder'}),
        address('c-1', 'site@x.fr', {origin: 'site'}),
      ],
    })

    await run(
      csv(
        line({
          id: 'c-1',
          address: '1 allée des Essais',
          emails: 'titulaire@x.fr',
        })
      )
    )

    expect(emailsOf('c-1')[1]).toMatchObject({
      email: 'site@x.fr',
      status: 'active',
    })
    expect(disableImportedEmail).not.toHaveBeenCalled()
  })

  it('décision B : titulaire à rôle, aucune adresse touchée, la fiche est « à corriger à la main »', async () => {
    given({
      profiles: [
        profile('c-1', {
          pennylaneImportSnapshot: snapshotOf(['presidente@x.fr']),
        }),
      ],
      emails: [address('c-1', 'presidente@x.fr', {role: 'holder'})],
      roles: {'presidente@x.fr': 'owner'},
    })

    const report = await run(
      csv(line({id: 'c-1', address: '2 rue Neuve', emails: 'autre@x.fr'}))
    )

    expect(addMemberProfileEmailService).not.toHaveBeenCalled()
    expect(disableImportedEmail).not.toHaveBeenCalled()
    expect(profileOf('c-1')?.homeAddressLine).toBe('2 rue Neuve')
    expect(report.manual).toEqual([
      {
        memberProfileId: 'c-1',
        name: 'Fiche c-1',
        holderEmail: 'presidente@x.fr',
        file: 'autre@x.fr',
      },
    ])
  })

  it('un refus board_email_required (défense) est rapporté « à corriger à la main », jamais levé', async () => {
    given({
      profiles: [
        profile('c-1', {
          pennylaneImportSnapshot: snapshotOf(['titulaire@x.fr', 'extra@x.fr']),
        }),
      ],
      emails: [
        address('c-1', 'titulaire@x.fr', {role: 'holder'}),
        address('c-1', 'extra@x.fr'),
      ],
    })
    vi.mocked(disableImportedEmail).mockResolvedValueOnce({
      status: 'board_email_required',
    })

    const report = await run(
      csv(line({id: 'c-1', address: '2 rue Neuve', emails: 'titulaire@x.fr'}))
    )

    expect(report.manual).toEqual([
      expect.objectContaining({
        memberProfileId: 'c-1',
        holderEmail: 'titulaire@x.fr',
      }),
    ])
    expect(report.rejections).toEqual([])
    expect(emailsOf('c-1')[1].status).toBe('active')
  })
})

describe('importAnnualMemberContactsService — rapprochement et rejets (critères 7, 8, 10)', () => {
  it('critère 7 : identifiant inconnu, aucune fiche créée, « membre à créer à la main »', async () => {
    const report = await run(
      csv(line({id: 'inconnu', name: 'Nouveau Venu', address: '1 rue'}))
    )

    expect(report.toCreate).toEqual([
      {line: 2, pennylaneCustomerId: 'inconnu', client: 'Nouveau Venu'},
    ])
    expect(report.membersToCreate).toBe(1)
    expect(db.writes).toEqual([])
    expect(setMemberProfileImportSnapshotDao).not.toHaveBeenCalled()
  })

  it('critère 8 : aucune parcelle n’est rattachée ni vendue', async () => {
    given({profiles: [profile('c-1')]})

    await run(
      csv(
        line({id: 'c-1', address: '2 rue Neuve'}),
        line({id: 'c-1', address: '2 rue Neuve'})
      )
    )

    expect(attachParcelService).not.toHaveBeenCalled()
    expect(recordSaleService).not.toHaveBeenCalled()
  })

  it('plusieurs fiches pour un identifiant à la casse près : ligne rejetée', async () => {
    given({profiles: [profile('abc'), profile('ABC')]})

    const report = await run(
      csv(line({id: 'Abc', name: 'Double', address: '1 rue'}))
    )

    expect(report.rejections).toEqual([
      {line: 2, client: 'Double', reason: 'ambiguous_customer_id'},
    ])
    expect(db.writes).toEqual([])
  })

  it('critère 10 : une fiche rejetée (code postal invalide) n’empêche pas la suivante et n’écrit rien', async () => {
    given({
      profiles: [profile('c-1'), profile('c-2')],
    })

    const report = await run(
      csv(
        line({id: 'c-1', name: 'Mauvais', address: '2 rue', postalCode: '123'}),
        line({id: 'c-2', address: '3 rue Bonne'}),
        line({id: '', name: 'Sans identifiant', address: '4 rue'})
      )
    )

    expect(report.rejections).toEqual([
      {line: 2, client: 'Mauvais', reason: 'invalid_postal_code'},
      {line: 4, client: 'Sans identifiant', reason: 'missing_customer_id'},
    ])
    expect(profileOf('c-1')?.homeAddressLine).toBe('1 allée des Essais')
    expect(profileOf('c-1')?.pennylaneImportSnapshot).toBeNull()
    expect(profileOf('c-2')?.homeAddressLine).toBe('3 rue Bonne')
    expect(report.linesRejected).toBe(2)
  })

  it('critère 10 : réimporter le même fichier ne change rien, hors instantané', async () => {
    given({
      profiles: [
        profile('c-1', {
          pennylaneImportSnapshot: snapshotOf(['ancienne@x.fr', 'extra@x.fr']),
        }),
        profile('c-2'),
      ],
      emails: [
        address('c-1', 'ancienne@x.fr', {role: 'holder'}),
        address('c-1', 'extra@x.fr'),
        address('c-1', 'site@x.fr', {origin: 'site'}),
      ],
    })
    const file = csv(
      line({
        id: 'c-1',
        address: '2 rue Neuve',
        emails: 'nouvelle@x.fr, autre@x.fr',
      }),
      line({id: 'c-2', address: '5 rue Haute', phone: '06 11 11 11 11'}),
      line({id: 'inconnu', address: '1 rue'})
    )

    await run(file)
    const before = structuredClone(db.state.emails)
    db.writes = []
    const replay = await run(file)

    expect(db.writes).toEqual([])
    expect(db.state.emails).toEqual(before)
    expect(replay).toMatchObject({
      profilesUpdated: 0,
      profilesUnchanged: 2,
      membersToCreate: 1,
      updated: [],
      kept: [],
      replaced: [],
      designated: [],
      disabled: [],
    })
  })

  it('décision D : une adresse désactivée qui réapparaît l’année suivante est réactivée', async () => {
    given({
      profiles: [
        profile('c-1', {
          pennylaneImportSnapshot: snapshotOf(['titulaire@x.fr']),
        }),
      ],
      emails: [
        address('c-1', 'titulaire@x.fr', {role: 'holder'}),
        address('c-1', 'revenue@x.fr', {status: 'disabled_by_import'}),
      ],
    })

    await run(
      csv(
        line({
          id: 'c-1',
          address: '1 allée des Essais',
          emails: 'titulaire@x.fr, revenue@x.fr',
        })
      )
    )

    expect(emailsOf('c-1')[1]).toMatchObject({
      email: 'revenue@x.fr',
      status: 'active',
      role: 'additional',
    })
  })

  it('le journal ne reçoit que des comptages', async () => {
    given({profiles: [profile('c-1')]})
    const info = vi.spyOn(logger, 'info')

    await run(csv(line({id: 'c-1', name: 'Lucie Secrète', address: '2 rue'})))

    const logged = JSON.stringify(info.mock.calls)
    expect(logged).not.toContain('Lucie')
    expect(logged).not.toContain('2 rue')
  })
})
