import {describe, expect, it} from 'vitest'

import {render, screen} from '@/__tests__/customRender'

import {ImpersonationNotice} from './impersonation-notice'

describe('ImpersonationNotice (s48, écran 4)', () => {
  it('retour explicite : alerte neutre annoncée comme statut', () => {
    render(<ImpersonationNotice kind="returned" />)

    expect(screen.getByRole('status')).toHaveTextContent(
      'Vous êtes revenu à votre compte SuperAdmin.'
    )
  })

  it('expiration : alerte neutre, sans nom (aucune donnée personnelle dans l’URL)', () => {
    render(<ImpersonationNotice kind="expired" />)

    expect(screen.getByRole('status')).toHaveTextContent(
      'La session à la place d’un compte s’est terminée. Reconnectez-vous pour continuer.'
    )
  })
})
