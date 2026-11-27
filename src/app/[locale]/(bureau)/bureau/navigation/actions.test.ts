import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({updateTag: vi.fn()}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() => Promise.resolve((key: string) => key)),
}))
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/user-dal', () => ({requireActionAuth: vi.fn()}))
vi.mock('@/services/facades/site-navigation-service-facade', () => ({
  addMenuItemService: vi.fn(),
  addMenuLinkService: vi.fn(),
  updateMenuLinkService: vi.fn(),
  removeMenuItemService: vi.fn(),
  reorderMenuItemsService: vi.fn(),
  setMenuItemVisibilityService: vi.fn(),
  saveSiteFooterService: vi.fn(),
}))

import {updateTag} from 'next/cache'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {NotFoundError} from '@/services/errors/not-found-error'
import {ValidationParsedZodError} from '@/services/errors/validation-error'
import {
  addMenuItemService,
  addMenuLinkService,
  removeMenuItemService,
  reorderMenuItemsService,
  saveSiteFooterService,
  setMenuItemVisibilityService,
  updateMenuLinkService,
} from '@/services/facades/site-navigation-service-facade'
import {MENU_ITEM_ALREADY_IN_MENU} from '@/services/types/domain/site-navigation-types'

import {
  addMenuItemAction,
  addMenuLinkAction,
  removeMenuItemAction,
  reorderMenuItemsAction,
  saveSiteFooterAction,
  setMenuItemVisibilityAction,
  updateMenuLinkAction,
} from './actions'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const MENU_ITEM_ID = '22222222-2222-4222-8222-222222222222'
const PAGE_ID = '33333333-3333-4333-8333-333333333333'
const NAVIGATION_TAG = `site-navigation:${TENANT_ID}`

const addedItem = {
  kind: 'page' as const,
  id: MENU_ITEM_ID,
  pageId: PAGE_ID,
  rank: 0,
  visible: true,
  pageTitle: "Qualité de l'eau",
  pageSlug: 'qualite-de-leau',
  pageStatus: 'published' as const,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(requireActionAuth).mockResolvedValue({id: 'user'} as never)
  vi.mocked(addMenuItemService).mockResolvedValue({
    status: 'added',
    item: addedItem,
  })
  vi.mocked(removeMenuItemService).mockResolvedValue()
  vi.mocked(reorderMenuItemsService).mockResolvedValue()
  vi.mocked(setMenuItemVisibilityService).mockResolvedValue()
  vi.mocked(saveSiteFooterService).mockResolvedValue()
})

describe('Actions du menu — succes', () => {
  it('ajoute une entree et invalide la navigation de cette association', async () => {
    const result = await addMenuItemAction(PAGE_ID)

    expect(requireActionAuth).toHaveBeenCalled()
    expect(addMenuItemService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      pageId: PAGE_ID,
    })
    expect(result).toEqual({status: 'added', item: addedItem})
    expect(updateTag).toHaveBeenCalledWith(NAVIGATION_TAG)
  })

  it('retire une entree et invalide la navigation', async () => {
    const result = await removeMenuItemAction(MENU_ITEM_ID)

    expect(removeMenuItemService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      menuItemId: MENU_ITEM_ID,
    })
    expect(result).toEqual({status: 'ok'})
    expect(updateTag).toHaveBeenCalledWith(NAVIGATION_TAG)
  })

  it('reordonne le menu dans l ordre recu', async () => {
    const result = await reorderMenuItemsAction([MENU_ITEM_ID, PAGE_ID])

    expect(reorderMenuItemsService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      orderedIds: [MENU_ITEM_ID, PAGE_ID],
    })
    expect(result).toEqual({status: 'ok'})
    expect(updateTag).toHaveBeenCalledWith(NAVIGATION_TAG)
  })

  it('bascule la visibilite d une entree', async () => {
    const result = await setMenuItemVisibilityAction(MENU_ITEM_ID, false)

    expect(setMenuItemVisibilityService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      menuItemId: MENU_ITEM_ID,
      visible: false,
    })
    expect(result).toEqual({status: 'ok'})
    expect(updateTag).toHaveBeenCalledWith(NAVIGATION_TAG)
  })

  it('enregistre le pied de page, vide compris', async () => {
    const result = await saveSiteFooterAction('')

    expect(saveSiteFooterService).toHaveBeenCalledWith(TENANT_ID, '')
    expect(result).toEqual({status: 'ok'})
    expect(updateTag).toHaveBeenCalledWith(NAVIGATION_TAG)
  })
})

describe('Actions du menu — refus', () => {
  it('rend un message lisible quand la page est deja au menu, sans invalider', async () => {
    vi.mocked(addMenuItemService).mockResolvedValue({
      status: 'rejected',
      error: MENU_ITEM_ALREADY_IN_MENU,
    })

    const result = await addMenuItemAction(PAGE_ID)

    expect(result).toEqual({status: 'error', message: 'alreadyInMenu'})
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('refuse un membre hors du bureau sur le menu', async () => {
    vi.mocked(removeMenuItemService).mockRejectedValue(new AuthorizationError())

    const result = await removeMenuItemAction(MENU_ITEM_ID)

    expect(result).toEqual({status: 'error', message: 'forbidden'})
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('refuse un membre hors du bureau sur le pied de page', async () => {
    vi.mocked(saveSiteFooterService).mockRejectedValue(new AuthorizationError())

    const result = await saveSiteFooterAction('Les Amis de l’Étang')

    expect(result).toEqual({status: 'error', message: 'forbidden'})
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('refuse sans session, sans appeler le service', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(new AuthorizationError())

    const result = await setMenuItemVisibilityAction(MENU_ITEM_ID, true)

    expect(result).toEqual({status: 'error', message: 'forbidden'})
    expect(setMenuItemVisibilityService).not.toHaveBeenCalled()
  })

  it('rend une panne comme un resultat, jamais levee', async () => {
    vi.mocked(reorderMenuItemsService).mockRejectedValue(
      new Error('connexion perdue')
    )

    const result = await reorderMenuItemsAction([MENU_ITEM_ID])

    expect(result).toEqual({status: 'error', message: 'failed'})
    expect(updateTag).not.toHaveBeenCalled()
  })
})

const LINK_ID = '44444444-4444-4444-8444-444444444444'

const savedLink = {
  kind: 'link' as const,
  id: LINK_ID,
  rank: 2,
  visible: true,
  label: 'Nous contacter',
  address: '/contact',
  target: 'internal' as const,
}

const linkForm = (values: Record<string, string>) => {
  const formData = new FormData()
  for (const [key, value] of Object.entries(values)) formData.set(key, value)
  return formData
}

/**
 * s50, critere 3 cote serveur : l'action rejoue le schema traduit et rend
 * l'erreur **sur le champ**, sans appeler la facade ni invalider le menu.
 */
describe('Actions d une entrée libre — refus par champ', () => {
  beforeEach(() => {
    vi.mocked(addMenuLinkService).mockResolvedValue(savedLink)
    vi.mocked(updateMenuLinkService).mockResolvedValue(savedLink)
  })

  it.each([
    [{label: '', address: '/contact'}, 'label', 'validation.labelRequired'],
    [{label: '   ', address: '/contact'}, 'label', 'validation.labelRequired'],
    [
      {label: 'a'.repeat(41), address: '/contact'},
      'label',
      'validation.labelTooLong',
    ],
    [{label: 'Contact', address: ''}, 'address', 'validation.addressRequired'],
    [
      {label: 'Contact', address: 'http://x.fr'},
      'address',
      'validation.addressHttp',
    ],
    [
      {label: 'Contact', address: 'javascript:alert(1)'},
      'address',
      'validation.addressRefused',
    ],
    [
      {label: 'Contact', address: 'data:text/html,<b>x</b>'},
      'address',
      'validation.addressRefused',
    ],
    [
      {label: 'Contact', address: '//hôte.example'},
      'address',
      'validation.addressRefused',
    ],
    [
      {label: 'Contact', address: '/\\hôte.example'},
      'address',
      'validation.addressRefused',
    ],
    [
      {label: 'Contact', address: `/${'a'.repeat(2048)}`},
      'address',
      'validation.addressTooLong',
    ],
  ])('refuse %j à l ajout, sur le champ %s', async (values, field, message) => {
    const result = await addMenuLinkAction(undefined, linkForm(values))

    expect(result).toEqual({status: 'invalid', errors: [{field, message}]})
    expect(addMenuLinkService).not.toHaveBeenCalled()
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('refuse une adresse dangereuse à la modification, sur le champ', async () => {
    const result = await updateMenuLinkAction(
      undefined,
      linkForm({
        menuItemId: LINK_ID,
        label: 'Contact',
        address: 'javascript:alert(1)',
      })
    )

    expect(result).toEqual({
      status: 'invalid',
      errors: [{field: 'address', message: 'validation.addressRefused'}],
    })
    expect(updateMenuLinkService).not.toHaveBeenCalled()
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('rend les deux champs fautifs ensemble', async () => {
    const result = await addMenuLinkAction(
      undefined,
      linkForm({label: '', address: 'http://x.fr'})
    )

    expect(result).toEqual({
      status: 'invalid',
      errors: [
        {field: 'label', message: 'validation.labelRequired'},
        {field: 'address', message: 'validation.addressHttp'},
      ],
    })
  })
})

describe('Actions d une entrée libre — succès et refus du service', () => {
  beforeEach(() => {
    vi.mocked(addMenuLinkService).mockResolvedValue(savedLink)
    vi.mocked(updateMenuLinkService).mockResolvedValue(savedLink)
  })

  it('ajoute une entrée libre et invalide le menu une fois (critère 6)', async () => {
    const result = await addMenuLinkAction(
      undefined,
      linkForm({label: ' Nous contacter ', address: ' /contact '})
    )

    expect(requireActionAuth).toHaveBeenCalled()
    expect(addMenuLinkService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      label: 'Nous contacter',
      address: '/contact',
    })
    expect(result).toEqual({status: 'saved', item: savedLink})
    expect(updateTag).toHaveBeenCalledTimes(1)
    expect(updateTag).toHaveBeenCalledWith(NAVIGATION_TAG)
  })

  it('modifie une entrée libre et invalide le menu une fois (critère 6)', async () => {
    const result = await updateMenuLinkAction(
      undefined,
      linkForm({
        menuItemId: LINK_ID,
        label: 'Mairie',
        address: 'https://www.saint-etang.fr',
      })
    )

    expect(updateMenuLinkService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      menuItemId: LINK_ID,
      label: 'Mairie',
      address: 'https://www.saint-etang.fr',
    })
    expect(result).toEqual({status: 'saved', item: savedLink})
    expect(updateTag).toHaveBeenCalledTimes(1)
    expect(updateTag).toHaveBeenCalledWith(NAVIGATION_TAG)
  })

  it('refuse un membre hors du bureau (critère 7)', async () => {
    vi.mocked(addMenuLinkService).mockRejectedValue(new AuthorizationError())

    const result = await addMenuLinkAction(
      undefined,
      linkForm({label: 'Contact', address: '/contact'})
    )

    expect(result).toEqual({status: 'error', message: 'errors.forbidden'})
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('refuse la modification hors du bureau (critère 7)', async () => {
    vi.mocked(updateMenuLinkService).mockRejectedValue(new AuthorizationError())

    const result = await updateMenuLinkAction(
      undefined,
      linkForm({menuItemId: LINK_ID, label: 'Contact', address: '/contact'})
    )

    expect(result).toEqual({status: 'error', message: 'errors.forbidden'})
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('rend l entrée introuvable comme un échec, sans invalider', async () => {
    vi.mocked(updateMenuLinkService).mockRejectedValue(new NotFoundError())

    const result = await updateMenuLinkAction(
      undefined,
      linkForm({menuItemId: LINK_ID, label: 'Contact', address: '/contact'})
    )

    expect(result).toEqual({status: 'error', message: 'errors.failed'})
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('rend un refus de validation du service en données invalides', async () => {
    vi.mocked(addMenuLinkService).mockRejectedValue(
      new ValidationParsedZodError()
    )

    const result = await addMenuLinkAction(
      undefined,
      linkForm({label: 'Contact', address: '/contact'})
    )

    expect(result).toEqual({status: 'error', message: 'errors.invalidData'})
    expect(updateTag).not.toHaveBeenCalled()
  })
})
