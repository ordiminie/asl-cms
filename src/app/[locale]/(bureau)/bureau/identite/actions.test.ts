import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({updateTag: vi.fn()}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() =>
    Promise.resolve((key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key
    )
  ),
}))
vi.mock('@/app/dal/tenant-dal', () => ({
  TENANT_CACHE_TAG: 'tenant',
  requireCurrentTenantDal: vi.fn(),
}))
vi.mock('@/app/dal/user-dal', () => ({requireActionAuth: vi.fn()}))
vi.mock('@/services/facades/association-identity-service-facade', () => ({
  replaceAssociationIdentityFileService: vi.fn(),
}))

import {updateTag} from 'next/cache'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {replaceAssociationIdentityFileService} from '@/services/facades/association-identity-service-facade'

import {replaceAssociationIdentityFileAction} from './actions'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const NEW_KEY = `${TENANT_ID}/identity/logo-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png`

const tenant = {
  id: TENANT_ID,
  name: 'ASL Les Pins',
  slug: 'asl-les-pins',
  domain: 'localhost',
  enabledModules: [],
  logoKey: `${TENANT_ID}/identity/logo-old.png`,
  faviconKey: null,
}

const uploadForm = (
  kind = 'logo',
  file: File | null = new File(['x'], 'l.png')
) => {
  const formData = new FormData()
  formData.set('kind', kind)
  if (file) formData.set('file', file)
  return formData
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue(tenant)
  vi.mocked(requireActionAuth).mockResolvedValue({id: 'user'} as never)
  vi.mocked(replaceAssociationIdentityFileService).mockResolvedValue({
    status: 'replaced',
    key: NEW_KEY,
  })
})

describe('replaceAssociationIdentityFileAction — succes', () => {
  it('remplace le fichier de l association du domaine appele', async () => {
    const file = new File(['png'], 'logo.png', {type: 'image/png'})

    const state = await replaceAssociationIdentityFileAction(
      undefined,
      uploadForm('logo', file)
    )

    expect(requireActionAuth).toHaveBeenCalled()
    expect(replaceAssociationIdentityFileService).toHaveBeenCalledWith(
      TENANT_ID,
      'logo',
      expect.any(File)
    )
    expect(state).toMatchObject({
      success: true,
      kind: 'logo',
      message: 'success.logo',
      version: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    })
  })

  it('invalide le cache du tenant apres succes : l identite change sans redeploiement', async () => {
    await replaceAssociationIdentityFileAction(undefined, uploadForm())

    expect(updateTag).toHaveBeenCalledWith('tenant')
  })
})

describe('replaceAssociationIdentityFileAction — refus cote serveur', () => {
  it('refuse un non-bureau, sans lever vers l interface ni invalider le cache', async () => {
    vi.mocked(replaceAssociationIdentityFileService).mockRejectedValue(
      new AuthorizationError()
    )

    const state = await replaceAssociationIdentityFileAction(
      undefined,
      uploadForm()
    )

    expect(state).toMatchObject({success: false, message: 'errors.forbidden'})
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('refuse un visiteur sans session, sans appeler le service', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(
      new AuthorizationError('Utilisateur non authentifié')
    )

    const state = await replaceAssociationIdentityFileAction(
      undefined,
      uploadForm()
    )

    expect(state).toMatchObject({success: false, message: 'errors.forbidden'})
    expect(replaceAssociationIdentityFileService).not.toHaveBeenCalled()
  })
})

describe('replaceAssociationIdentityFileAction — fichier refuse', () => {
  it('nomme le format refuse, ce qui est conserve et l action suivante', async () => {
    vi.mocked(replaceAssociationIdentityFileService).mockResolvedValue({
      status: 'rejected',
      validation: {valid: false, reason: 'format', detectedFormat: 'jpeg'},
    })

    const state = await replaceAssociationIdentityFileAction(
      undefined,
      uploadForm()
    )

    expect(state).toMatchObject({
      success: false,
      kind: 'logo',
      title: 'errors.notSaved',
      message: 'errors.formatRefused {"format":"JPEG"}',
      kept: 'errors.kept.logo',
      nextStep: 'errors.chooseFormat.logo',
    })
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('signale un format non reconnu', async () => {
    vi.mocked(replaceAssociationIdentityFileService).mockResolvedValue({
      status: 'rejected',
      validation: {valid: false, reason: 'format'},
    })

    const state = await replaceAssociationIdentityFileAction(
      undefined,
      uploadForm()
    )

    expect(state.message).toBe('errors.formatUnknown')
  })

  it('donne le poids du fichier et la limite', async () => {
    vi.mocked(replaceAssociationIdentityFileService).mockResolvedValue({
      status: 'rejected',
      validation: {
        valid: false,
        reason: 'size',
        size: Math.round(3.2 * 1024 * 1024),
        maxBytes: 1024 * 1024,
      },
    })

    const state = await replaceAssociationIdentityFileAction(
      undefined,
      uploadForm()
    )

    expect(state.message).toBe(
      'errors.tooLarge {"size":"sizes.megabytes {\\"value\\":3.2}","limit":"sizes.megabytes {\\"value\\":1}"}'
    )
  })

  it('exprime la limite du favicon en Ko, et annonce le favicon par defaut quand il n y en a pas', async () => {
    vi.mocked(replaceAssociationIdentityFileService).mockResolvedValue({
      status: 'rejected',
      validation: {
        valid: false,
        reason: 'size',
        size: 300 * 1024,
        maxBytes: 200 * 1024,
      },
    })

    const state = await replaceAssociationIdentityFileAction(
      undefined,
      uploadForm('favicon')
    )

    expect(state.message).toContain('sizes.kilobytes {\\"value\\":200}')
    expect(state.kept).toBe('errors.keptDefault.favicon')
  })

  it('refuse un formulaire sans fichier ou au type inconnu, sans appeler le service', async () => {
    const withoutFile = await replaceAssociationIdentityFileAction(
      undefined,
      uploadForm('logo', null)
    )
    const unknownKind = await replaceAssociationIdentityFileAction(
      undefined,
      uploadForm('banniere')
    )

    expect(withoutFile).toMatchObject({
      success: false,
      message: 'errors.invalidData',
    })
    expect(unknownKind).toMatchObject({
      success: false,
      message: 'errors.invalidData',
    })
    expect(replaceAssociationIdentityFileService).not.toHaveBeenCalled()
  })

  it('rend un echec technique comme un resultat, jamais une exception', async () => {
    vi.mocked(replaceAssociationIdentityFileService).mockRejectedValue(
      new Error('disque plein')
    )

    const state = await replaceAssociationIdentityFileAction(
      undefined,
      uploadForm()
    )

    expect(state).toMatchObject({
      success: false,
      title: 'errors.notSaved',
      message: 'errors.failed',
      kept: 'errors.kept.logo',
    })
  })
})
