import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({headers: vi.fn()}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() =>
    Promise.resolve((key: string) => `ContactPage.${key}`)
  ),
}))
vi.mock('@/app/dal/tenant-dal', () => ({
  getCurrentTenantDal: vi.fn(),
  withCurrentTenant: vi.fn(
    async (callback: () => Promise<unknown>) => await callback()
  ),
}))
vi.mock('@/services/facades/user-submission-service-facade', () => ({
  createUserSubmissionService: vi.fn(),
}))

import {headers} from 'next/headers'

import {getCurrentTenantDal, withCurrentTenant} from '@/app/dal/tenant-dal'
import {createUserSubmissionService} from '@/services/facades/user-submission-service-facade'

import {submitContactAction} from './actions'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'

const tenant = {
  id: TENANT_ID,
  name: 'ASL La Fourche',
  slug: 'asl-la-fourche',
  domain: 'asl-lafourche.fr',
  enabledModules: [],
  logoKey: null,
  faviconKey: null,
}

let ipCounter = 0

const contactForm = () => {
  const formData = new FormData()
  formData.set('email', 'proprietaire@example.test')
  formData.set('subject', 'Un lampadaire est cassé')
  formData.set(
    'content',
    'Le lampadaire de la rue des Tilleuls ne marche plus.'
  )
  return formData
}

beforeEach(() => {
  vi.clearAllMocks()
  ipCounter += 1
  // Le formulaire est limite en debit par IP : une IP distincte par test.
  vi.mocked(headers).mockResolvedValue(
    new Headers({'x-forwarded-for': `10.0.0.${ipCounter}`}) as never
  )
  vi.mocked(getCurrentTenantDal).mockResolvedValue(tenant)
})

describe('submitContactAction', () => {
  it("rattache la soumission a l'association servie par le domaine", async () => {
    const state = await submitContactAction(
      {success: false, message: ''},
      contactForm()
    )

    expect(state.success).toBe(true)
    expect(createUserSubmissionService).toHaveBeenCalledWith(
      expect.objectContaining({organizationId: TENANT_ID})
    )
  })

  it('ecrit dans le scope du tenant, sans quoi la policy RLS refuserait la ligne', async () => {
    await submitContactAction({success: false, message: ''}, contactForm())

    expect(withCurrentTenant).toHaveBeenCalled()
  })

  it("n'ecrit rien sur un domaine qui ne sert aucune association", async () => {
    vi.mocked(getCurrentTenantDal).mockResolvedValue(undefined)

    const state = await submitContactAction(
      {success: false, message: ''},
      contactForm()
    )

    expect(state.success).toBe(false)
    expect(createUserSubmissionService).not.toHaveBeenCalled()
  })
})
