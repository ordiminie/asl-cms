import {ReactElement} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))
vi.mock('next-intl/server', async () => {
  const actual =
    await vi.importActual<typeof import('next-intl/server')>('next-intl/server')

  return {...actual, setRequestLocale: vi.fn()}
})
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/contact-message-dal', () => ({
  canManageCurrentContactMessagesDal: vi.fn(),
  getContactMessageForBureauDal: vi.fn(),
}))
vi.mock('../actions', () => ({
  markContactMessageReadAction: vi.fn(async () => ({status: 'saved'})),
  markContactMessageUnreadAction: vi.fn(),
}))

import {render, screen, userEvent, waitFor} from '@/__tests__/customRender'
import {
  canManageCurrentContactMessagesDal,
  getContactMessageForBureauDal,
} from '@/app/dal/contact-message-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'

import {
  markContactMessageReadAction,
  markContactMessageUnreadAction,
} from '../actions'
import BureauContactMessagePage from './page'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const MESSAGE_ID = '33333333-3333-4333-8333-333333333333'

const resolveSection = async () => {
  const element = (await BureauContactMessagePage({
    params: Promise.resolve({locale: 'fr', id: MESSAGE_ID}),
  })) as ReactElement<{children: ReactElement}>
  const section = element.props.children
  const type = section.type as (props: unknown) => Promise<ReactElement>
  return type(section.props)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(getContactMessageForBureauDal).mockResolvedValue({
    id: MESSAGE_ID,
    organizationId: TENANT_ID,
    senderName: 'Claire Meunier',
    senderEmail: 'claire.meunier@example.fr',
    subject: "Analyse d'eau du forage",
    body: 'Bonjour',
    read: false,
    notificationFailed: false,
    createdAt: new Date('2026-09-02T12:32:00Z'),
  })
})

describe('/bureau/messages/[id] — accès par rôle', () => {
  it('ouvre le message pour le bureau et le marque lu au montage', async () => {
    vi.mocked(canManageCurrentContactMessagesDal).mockResolvedValue(true)

    render(await resolveSection())

    expect(
      screen.getByRole('heading', {level: 1, name: "Analyse d'eau du forage"})
    ).toBeInTheDocument()
    expect(getContactMessageForBureauDal).toHaveBeenCalledWith(
      TENANT_ID,
      MESSAGE_ID
    )
    await waitFor(() =>
      expect(markContactMessageReadAction).toHaveBeenCalledWith(MESSAGE_ID)
    )
  })

  it('attend le marquage lu de l’ouverture avant de marquer non lu', async () => {
    const user = userEvent.setup()
    vi.mocked(canManageCurrentContactMessagesDal).mockResolvedValue(true)
    vi.mocked(markContactMessageReadAction).mockReturnValue(
      new Promise(() => {})
    )

    render(await resolveSection())
    await waitFor(() =>
      expect(markContactMessageReadAction).toHaveBeenCalledWith(MESSAGE_ID)
    )
    await user.click(screen.getByRole('button', {name: 'Marquer comme non lu'}))

    expect(markContactMessageUnreadAction).not.toHaveBeenCalled()
  })

  it('refuse un membre simple, sans lire ni marquer le message', async () => {
    vi.mocked(canManageCurrentContactMessagesDal).mockResolvedValue(false)

    render(await resolveSection())

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: "Cette page est réservée au bureau de l'association",
      })
    ).toBeInTheDocument()
    expect(getContactMessageForBureauDal).not.toHaveBeenCalled()
    expect(markContactMessageReadAction).not.toHaveBeenCalled()
  })

  it('rend une 404 pour un message absent de cette association', async () => {
    vi.mocked(canManageCurrentContactMessagesDal).mockResolvedValue(true)
    vi.mocked(getContactMessageForBureauDal).mockResolvedValue(undefined)

    await expect(resolveSection()).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
