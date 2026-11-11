import {ReactElement} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({useRouter: () => ({push: vi.fn()})}))
vi.mock('next-intl/server', async () => {
  const actual =
    await vi.importActual<typeof import('next-intl/server')>('next-intl/server')
  const messages = (await import('../../../../../../../messages/fr.json'))
    .default as Record<string, unknown>
  const read = (key: string) =>
    key
      .split('.')
      .reduce<unknown>(
        (node, part) => (node as Record<string, unknown>)[part],
        messages
      )

  return {
    ...actual,
    setRequestLocale: vi.fn(),
    getTranslations: vi.fn(async (namespace: string) => {
      const t = (key: string) => String(read(`${namespace}.${key}`))
      t.raw = (key: string) => read(`${namespace}.${key}`)
      return t
    }),
  }
})
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/campaign-dal', () => ({
  canManageCurrentCampaignsDal: vi.fn(),
  getCampaignComposerContextDal: vi.fn(),
}))
vi.mock('../actions', () => ({
  previewCampaignAction: vi.fn(),
  sendCampaignAction: vi.fn(),
}))

import {render, screen, userEvent} from '@/__tests__/customRender'
import {
  canManageCurrentCampaignsDal,
  getCampaignComposerContextDal,
} from '@/app/dal/campaign-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'

import messages from '../../../../../../../messages/fr.json'
import NewCampaignPage from './page'

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const TENANT_ID = '11111111-1111-4111-8111-111111111111'

const renderPage = async () => {
  const element = (await NewCampaignPage({
    params: Promise.resolve({locale: 'fr'}),
  })) as ReactElement<{children: ReactElement}>
  const section = element.props.children
  const type = section.type as (props: unknown) => Promise<ReactElement>

  render(await type(section.props))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(getCampaignComposerContextDal).mockResolvedValue({
    associationName: 'ASL Les Pins',
    replyTo: null,
    subjectMaxLength: 45,
    counts: {recipients: 2, withoutEmail: 1, unsubscribed: 0, total: 3},
    reachableMembers: [],
  })
})

describe('/bureau/campagnes/nouvelle', () => {
  it('ouvre le composeur au bureau, modèles lus bruts dans les messages', async () => {
    vi.mocked(canManageCurrentCampaignsDal).mockResolvedValue(true)

    await renderPage()

    expect(getCampaignComposerContextDal).toHaveBeenCalledWith(TENANT_ID)
    await userEvent.click(
      screen.getByRole('radio', {name: /Convocation à l’AG/})
    )
    expect(screen.getByRole('textbox', {name: 'Message'})).toHaveValue(
      messages.email.campaign.templates.general_assembly.body
    )
  })

  it('refuse un membre simple sans lire le décompte', async () => {
    vi.mocked(canManageCurrentCampaignsDal).mockResolvedValue(false)

    await renderPage()

    expect(getCampaignComposerContextDal).not.toHaveBeenCalled()
    expect(screen.queryByRole('radio')).toBeNull()
  })
})
