import {ReactElement} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next-intl/server', async () => {
  const actual =
    await vi.importActual<typeof import('next-intl/server')>('next-intl/server')

  return {...actual, setRequestLocale: vi.fn()}
})
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/unsubscribe-dal', () => ({
  getUnsubscribePageStateDal: vi.fn(),
}))
vi.mock('@/app/dal/association-settings-dal', () => ({
  getAssociationSettingsDal: vi.fn(),
}))
vi.mock('@/services/facades/unsubscribe-service-facade', () => ({
  confirmUnsubscribeService: vi.fn(),
  getUnsubscribePageStateService: vi.fn(),
}))
vi.mock('./actions', () => ({confirmUnsubscribeAction: vi.fn()}))
vi.mock('@/components/features/association/association-mark', () => ({
  AssociationMark: ({name}: {name: string}) => <span>{name}</span>,
}))

import {render, screen, userEvent} from '@/__tests__/customRender'
import {getAssociationSettingsDal} from '@/app/dal/association-settings-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {getUnsubscribePageStateDal} from '@/app/dal/unsubscribe-dal'
import {confirmUnsubscribeService} from '@/services/facades/unsubscribe-service-facade'

import {confirmUnsubscribeAction} from './actions'
import UnsubscribePage, {metadata} from './page'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const TOKEN = 'k7Q2xP9m'.padEnd(43, 'A')

const renderPage = async () => {
  const element = (await UnsubscribePage({
    params: Promise.resolve({locale: 'fr', jeton: TOKEN}),
  })) as ReactElement<{children: ReactElement}>
  const section = element.props.children
  const type = section.type as (props: unknown) => Promise<ReactElement>

  return render(await type(section.props))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({
    id: TENANT_ID,
    name: 'ASL Les Pins',
    logoKey: null,
  } as never)
  vi.mocked(getAssociationSettingsDal).mockResolvedValue({
    'contact.email': {value: 'contact@lespins.example', isDefault: false},
  } as never)
  vi.mocked(getUnsubscribePageStateDal).mockResolvedValue({
    status: 'confirm',
    statutoryTemplateIds: ['general_assembly'],
  })
  vi.mocked(confirmUnsubscribeAction).mockResolvedValue({
    status: 'unsubscribed',
  })
})

describe('/desinscription/[jeton] — écran 6 du design s25', () => {
  it('a · demande : un h1, « Me désinscrire », et RIEN n’est écrit au rendu', async () => {
    await renderPage()

    expect(getUnsubscribePageStateDal).toHaveBeenCalledWith(TENANT_ID, TOKEN)
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Ne plus recevoir les campagnes de ASL Les Pins',
      })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', {name: 'Me désinscrire'})).toBeEnabled()
    expect(
      screen.getByText(
        'Cette adresse ne recevra plus les campagnes que le bureau envoie par email aux membres. Les autres adresses de votre espace les recevront encore.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: 'Je garde les campagnes'})
    ).toHaveAttribute('href', '/')
    expect(confirmUnsubscribeAction).not.toHaveBeenCalled()
    expect(confirmUnsubscribeService).not.toHaveBeenCalled()
  })

  it('b · confirmée : le bouton écrit, la page le confirme', async () => {
    await renderPage()

    await userEvent.click(screen.getByRole('button', {name: 'Me désinscrire'}))

    expect(
      await screen.findByText(
        'C’est enregistré. Cette adresse ne recevra plus les campagnes de ASL Les Pins.'
      )
    ).toBeInTheDocument()
    expect(confirmUnsubscribeAction).toHaveBeenCalledTimes(1)
    const formData = vi.mocked(confirmUnsubscribeAction).mock
      .calls[0][1] as FormData
    expect(formData.get('token')).toBe(TOKEN)
    expect(
      screen.getByRole('link', {name: 'Aller sur le site de l’association'})
    ).toHaveAttribute('href', '/')
  })

  it('c · déjà désinscrit', async () => {
    vi.mocked(getUnsubscribePageStateDal).mockResolvedValue({
      status: 'already',
      statutoryTemplateIds: [],
    })

    await renderPage()

    expect(
      screen.getByText(
        'Cette adresse est déjà désinscrite. Rien d’autre à faire.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', {name: 'Me désinscrire'})).toBeNull()
  })

  it('d · lien invalide : titre propre, adresse de contact de l’association', async () => {
    vi.mocked(getUnsubscribePageStateDal).mockResolvedValue({status: 'invalid'})

    await renderPage()

    expect(
      screen.getByRole('heading', {level: 1, name: 'Ce lien ne fonctionne pas'})
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Rien n’a été modifié. Vous pouvez écrire au bureau de l’association : contact@lespins.example.'
      )
    ).toBeInTheDocument()
  })

  it('e · échec technique à la confirmation : rien n’a changé, on peut réessayer', async () => {
    vi.mocked(confirmUnsubscribeAction).mockResolvedValue({status: 'error'})
    await renderPage()

    await userEvent.click(screen.getByRole('button', {name: 'Me désinscrire'}))

    expect(
      await screen.findByText('Votre demande n’a pas pu être enregistrée.')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', {name: 'Me désinscrire'})).toBeEnabled()
  })

  it('e · échec technique à la lecture : même message, bouton proposé', async () => {
    vi.mocked(getUnsubscribePageStateDal).mockRejectedValue(new Error('panne'))

    await renderPage()

    expect(
      screen.getByText('Votre demande n’a pas pu être enregistrée.')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', {name: 'Me désinscrire'})).toBeEnabled()
  })

  it('dit ce que le membre continuera de recevoir, d’après la classification lue (s27b, critère 5)', async () => {
    await renderPage()

    expect(
      screen.getByRole('list', {
        name: 'Vous continuerez de recevoir, parce que votre appartenance à l’association vous y engage :',
      })
    ).toHaveTextContent('Convocation à l’AG')
  })

  it('lecture en échec : aucune promesse sur ce qui continue', async () => {
    vi.mocked(getUnsubscribePageStateDal).mockRejectedValue(new Error('panne'))

    const {container} = await renderPage()

    expect(container.textContent).not.toMatch(/continuerez|plus aucune/i)
  })

  it('noindex et aucun référent : le jeton est dans l’URL', () => {
    expect(metadata.robots).toEqual({index: false, follow: false})
    expect(metadata.referrer).toBe('no-referrer')
  })
})
