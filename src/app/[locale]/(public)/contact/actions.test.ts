import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() =>
    Promise.resolve((key: string) => `ContactPage.${key}`)
  ),
}))
vi.mock('@/app/dal/tenant-dal', () => ({
  getCurrentTenantDal: vi.fn(),
}))
vi.mock('@/services/facades/contact-message-service-facade', () => ({
  createContactMessageService: vi.fn(),
}))

import {getTranslations} from 'next-intl/server'

import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {createContactMessageService} from '@/services/facades/contact-message-service-facade'

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

const contactForm = (overrides: Record<string, string> = {}) => {
  const formData = new FormData()
  const values = {
    locale: 'fr',
    name: 'Claire Meunier',
    email: 'proprietaire@example.test',
    subject: 'Un lampadaire est cassé',
    content: 'Le lampadaire de la rue des Tilleuls ne marche plus.',
    ...overrides,
  }
  for (const [key, value] of Object.entries(values)) formData.set(key, value)
  return formData
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCurrentTenantDal).mockResolvedValue(tenant)
  vi.mocked(createContactMessageService).mockResolvedValue({
    status: 'created',
    id: '33333333-3333-4333-8333-333333333333',
    notificationFailed: false,
  })
})

describe('submitContactAction', () => {
  it("enregistre le message pour l'association servie par le domaine", async () => {
    const state = await submitContactAction({status: 'idle'}, contactForm())

    expect(state).toEqual({status: 'sent'})
    expect(createContactMessageService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      locale: 'fr',
      name: 'Claire Meunier',
      email: 'proprietaire@example.test',
      subject: 'Un lampadaire est cassé',
      body: 'Le lampadaire de la rue des Tilleuls ne marche plus.',
    })
  })

  it('n’envoie aucune adresse IP au service', async () => {
    await submitContactAction({status: 'idle'}, contactForm())

    const [input] = vi.mocked(createContactMessageService).mock.calls[0]
    expect(JSON.stringify(input)).not.toMatch(/ip|forwarded/i)
  })

  it('reste un succès quand la notification au bureau n’est pas partie', async () => {
    vi.mocked(createContactMessageService).mockResolvedValue({
      status: 'created',
      id: '33333333-3333-4333-8333-333333333333',
      notificationFailed: true,
    })

    const state = await submitContactAction({status: 'idle'}, contactForm())

    expect(state).toEqual({status: 'sent'})
  })

  it('rejette un email mal formé et un message vide, champ par champ, sans rien écrire', async () => {
    const state = await submitContactAction(
      {status: 'idle'},
      contactForm({email: 'pas-une-adresse', content: '   '})
    )

    expect(state).toEqual({
      status: 'invalid',
      errors: [
        {field: 'email', message: 'ContactPage.validation.emailInvalid'},
        {field: 'content', message: 'ContactPage.validation.contentRequired'},
      ],
    })
    expect(createContactMessageService).not.toHaveBeenCalled()
  })

  it('traduit dans la locale du formulaire, pas dans celle du cookie', async () => {
    await submitContactAction({status: 'idle'}, contactForm({locale: 'fr'}))

    expect(getTranslations).toHaveBeenCalledWith({
      locale: 'fr',
      namespace: 'ContactPage',
    })
  })

  it('ramène une locale que le routage ne sert pas à la locale du produit', async () => {
    await submitContactAction({status: 'idle'}, contactForm({locale: 'xx'}))

    expect(createContactMessageService).toHaveBeenCalledWith(
      expect.objectContaining({locale: 'fr'})
    )
  })

  it('omet le nom laissé vide', async () => {
    await submitContactAction({status: 'idle'}, contactForm({name: ''}))

    const [input] = vi.mocked(createContactMessageService).mock.calls[0]
    expect(input.name).toBeUndefined()
  })

  it("n'écrit rien sur un domaine qui ne sert aucune association", async () => {
    vi.mocked(getCurrentTenantDal).mockResolvedValue(undefined)

    await expect(
      submitContactAction({status: 'idle'}, contactForm())
    ).rejects.toThrow()
    expect(createContactMessageService).not.toHaveBeenCalled()
  })
})
