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
vi.mock('@/services/facades/rate-limit-service-facade', () => ({
  consumeContactMessageQuotaService: vi.fn(),
}))
vi.mock('next/headers', () => ({headers: vi.fn()}))

import {headers} from 'next/headers'
import {getTranslations} from 'next-intl/server'

import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {createContactMessageService} from '@/services/facades/contact-message-service-facade'
import {consumeContactMessageQuotaService} from '@/services/facades/rate-limit-service-facade'

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

const VISITOR_IP = '203.0.113.7'

const requestHeaders = (values: Record<string, string>) =>
  vi
    .mocked(headers)
    .mockResolvedValue(
      new Headers(values) as Awaited<ReturnType<typeof headers>>
    )

beforeEach(() => {
  vi.clearAllMocks()
  requestHeaders({'x-forwarded-for': VISITOR_IP})
  vi.mocked(consumeContactMessageQuotaService).mockResolvedValue({
    allowed: true,
    limit: 3,
  })
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

  it('consomme le quota du visiteur, reconnu à son adresse IP, pour l’association servie', async () => {
    await submitContactAction({status: 'idle'}, contactForm())

    expect(consumeContactMessageQuotaService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      ip: VISITOR_IP,
    })
  })

  it('refuse l’envoi au-delà du seuil, sans rien écrire, en rendant le seuil', async () => {
    vi.mocked(consumeContactMessageQuotaService).mockResolvedValue({
      allowed: false,
      limit: 3,
    })

    const state = await submitContactAction({status: 'idle'}, contactForm())

    expect(state).toEqual({status: 'rate_limited', limit: 3})
    expect(createContactMessageService).not.toHaveBeenCalled()
  })

  it('ne consomme le quota qu’après la validation, et avant l’écriture', async () => {
    await submitContactAction(
      {status: 'idle'},
      contactForm({email: 'pas-une-adresse'})
    )
    expect(consumeContactMessageQuotaService).not.toHaveBeenCalled()

    await submitContactAction({status: 'idle'}, contactForm())
    expect(
      vi.mocked(consumeContactMessageQuotaService).mock.invocationCallOrder[0]
    ).toBeLessThan(
      vi.mocked(createContactMessageService).mock.invocationCallOrder[0]
    )
  })

  it('lit la dernière adresse de x-forwarded-for, celle posée par le proxy, pas celle du client', async () => {
    requestHeaders({'x-forwarded-for': `198.51.100.99, ${VISITOR_IP}`})

    await submitContactAction({status: 'idle'}, contactForm())

    expect(consumeContactMessageQuotaService).toHaveBeenCalledWith(
      expect.objectContaining({ip: VISITOR_IP})
    )
  })

  it('se rabat sur x-real-ip sans x-forwarded-for', async () => {
    requestHeaders({'x-real-ip': VISITOR_IP})

    await submitContactAction({status: 'idle'}, contactForm())

    expect(consumeContactMessageQuotaService).toHaveBeenCalledWith(
      expect.objectContaining({ip: VISITOR_IP})
    )
  })

  it('sans en-tête d’adresse, laisse le service décider, sans IP', async () => {
    requestHeaders({})

    await submitContactAction({status: 'idle'}, contactForm())

    expect(consumeContactMessageQuotaService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      ip: undefined,
    })
  })

  it('ne transmet jamais l’adresse IP au service des messages', async () => {
    await submitContactAction({status: 'idle'}, contactForm())

    const [input] = vi.mocked(createContactMessageService).mock.calls[0]
    expect(JSON.stringify(input)).not.toContain(VISITOR_IP)
  })
})
