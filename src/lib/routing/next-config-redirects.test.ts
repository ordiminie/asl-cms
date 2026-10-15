import {describe, expect, it} from 'vitest'

import nextConfig from '../../../next.config'

describe('redirections de next.config.ts', () => {
  it('envoie /bureau vers /bureau/pages, sans redirection permanente (s46b, décision H)', async () => {
    const redirects = (await nextConfig.redirects?.()) ?? []

    expect(redirects).toContainEqual({
      source: '/bureau',
      destination: '/bureau/pages',
      permanent: false,
    })
  })

  it('garde les redirections des anciens préfixes de langue (ADR 031)', async () => {
    const redirects = (await nextConfig.redirects?.()) ?? []

    expect(redirects).toContainEqual({
      source: '/fr/:path*',
      destination: '/:path*',
      permanent: true,
    })
  })
})
