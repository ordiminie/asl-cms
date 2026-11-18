import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({revalidatePath: vi.fn()}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() =>
    Promise.resolve(
      (key: string, values?: Record<string, unknown>) =>
        `RecipientGroupsBureau.${key}${values ? JSON.stringify(values) : ''}`
    )
  ),
}))
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/user-dal', () => ({requireActionAuth: vi.fn()}))
vi.mock('@/services/facades/recipient-group-service-facade', () => ({
  createRecipientGroupService: vi.fn(),
  renameRecipientGroupService: vi.fn(),
  deleteRecipientGroupService: vi.fn(),
}))

import {revalidatePath} from 'next/cache'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {NotFoundError} from '@/services/errors/not-found-error'
import {DuplicateRecipientGroupNameError} from '@/services/errors/recipient-group-errors'
import {
  createRecipientGroupService,
  deleteRecipientGroupService,
  renameRecipientGroupService,
} from '@/services/facades/recipient-group-service-facade'

import {
  createRecipientGroupAction,
  deleteRecipientGroupAction,
  renameRecipientGroupAction,
} from './actions'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const GROUP_ID = '33333333-3333-4333-8333-333333333333'
const ROUTE = '/[locale]/(bureau)/bureau/groupes'
const group = {id: GROUP_ID, name: 'Riverains', profileCount: 0}

const formOf = (values: Record<string, string>) => {
  const formData = new FormData()
  for (const [key, value] of Object.entries(values)) formData.set(key, value)
  return formData
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(requireActionAuth).mockResolvedValue({id: 'u1'} as never)
  vi.mocked(createRecipientGroupService).mockResolvedValue(group)
  vi.mocked(renameRecipientGroupService).mockResolvedValue(group)
  vi.mocked(deleteRecipientGroupService).mockResolvedValue()
})

describe('createRecipientGroupAction', () => {
  it('crée le groupe dans le tenant du domaine, puis revalide', async () => {
    const result = await createRecipientGroupAction(
      undefined,
      formOf({name: '  Riverains '})
    )

    expect(result).toEqual({status: 'saved', group})
    expect(createRecipientGroupService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      name: 'Riverains',
    })
    expect(revalidatePath).toHaveBeenCalledWith(ROUTE, 'layout')
  })

  it('nom vide → message sous le champ, rien n’est écrit', async () => {
    await expect(
      createRecipientGroupAction(undefined, formOf({name: '  '}))
    ).resolves.toEqual({
      status: 'invalid',
      message: 'RecipientGroupsBureau.validation.nameRequired',
    })
    expect(createRecipientGroupService).not.toHaveBeenCalled()
  })

  it('nom déjà pris → message sous le champ', async () => {
    vi.mocked(createRecipientGroupService).mockRejectedValue(
      new DuplicateRecipientGroupNameError()
    )

    await expect(
      createRecipientGroupAction(undefined, formOf({name: 'riverains'}))
    ).resolves.toEqual({
      status: 'invalid',
      message: 'RecipientGroupsBureau.errors.duplicateName',
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('sans droit → refus nommé', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(new AuthorizationError())

    await expect(
      createRecipientGroupAction(undefined, formOf({name: 'Riverains'}))
    ).resolves.toEqual({
      status: 'error',
      message: 'RecipientGroupsBureau.errors.forbidden',
    })
  })
})

describe('renameRecipientGroupAction', () => {
  it('renomme le groupe désigné', async () => {
    await renameRecipientGroupAction(
      undefined,
      formOf({groupId: GROUP_ID, name: 'Bord de mer'})
    )

    expect(renameRecipientGroupService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      groupId: GROUP_ID,
      name: 'Bord de mer',
    })
    expect(revalidatePath).toHaveBeenCalledWith(ROUTE, 'layout')
  })

  it('groupe introuvable → message', async () => {
    vi.mocked(renameRecipientGroupService).mockRejectedValue(
      new NotFoundError()
    )

    await expect(
      renameRecipientGroupAction(
        undefined,
        formOf({groupId: GROUP_ID, name: 'Bord de mer'})
      )
    ).resolves.toEqual({
      status: 'error',
      message: 'RecipientGroupsBureau.errors.notFound',
    })
  })
})

describe('deleteRecipientGroupAction', () => {
  it('supprime le groupe, puis revalide', async () => {
    await expect(
      deleteRecipientGroupAction(undefined, formOf({groupId: GROUP_ID}))
    ).resolves.toEqual({status: 'deleted'})
    expect(deleteRecipientGroupService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      groupId: GROUP_ID,
    })
    expect(revalidatePath).toHaveBeenCalledWith(ROUTE, 'layout')
  })

  it('une panne → message générique, sans revalidation', async () => {
    vi.mocked(deleteRecipientGroupService).mockRejectedValue(new Error('x'))

    await expect(
      deleteRecipientGroupAction(undefined, formOf({groupId: GROUP_ID}))
    ).resolves.toEqual({
      status: 'error',
      message: 'RecipientGroupsBureau.errors.failed',
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
