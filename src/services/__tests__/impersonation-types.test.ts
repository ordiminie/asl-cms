import {describe, expect, it} from 'vitest'

import {effectiveAuthor} from '../types/domain/impersonation-types'

const viewer = {id: 'compte-vise', name: 'Claire Montel'}
const impersonator = {id: 'superadmin', name: 'Zoé Support'}

describe('effectiveAuthor (s48, critère 6)', () => {
  it('hors imitation : l’auteur est le compte, « pour le compte de » nul', () => {
    expect(effectiveAuthor(viewer)).toEqual({
      authorUserId: 'compte-vise',
      authorName: 'Claire Montel',
      onBehalfOfUserId: null,
      onBehalfOfName: null,
    })
  })

  it('pendant l’imitation : l’auteur est le SuperAdmin, pour le compte du compte vu', () => {
    expect(effectiveAuthor(viewer, impersonator)).toEqual({
      authorUserId: 'superadmin',
      authorName: 'Zoé Support',
      onBehalfOfUserId: 'compte-vise',
      onBehalfOfName: 'Claire Montel',
    })
  })
})
