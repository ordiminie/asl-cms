import {describe, expect, it, vi} from 'vitest'

import {render, screen, userEvent, waitFor} from '@/__tests__/customRender'

import {
  ContactMessageDetail,
  type ContactMessageReadActionResult,
} from './contact-message-detail'
import {MarkReadOnOpen} from './mark-read-on-open'

const MESSAGE_ID = '33333333-3333-4333-8333-333333333333'

describe('MarkReadOnOpen — décision E', () => {
  it('marque le message lu une fois, au montage, sans rien rendre', async () => {
    const markReadAction = vi.fn(async () => ({status: 'saved' as const}))
    const {rerender} = render(
      <div data-testid="host">
        <MarkReadOnOpen
          messageId={MESSAGE_ID}
          markReadAction={markReadAction}
        />
      </div>
    )
    rerender(
      <div data-testid="host">
        <MarkReadOnOpen
          messageId={MESSAGE_ID}
          markReadAction={markReadAction}
        />
      </div>
    )

    await waitFor(() => expect(markReadAction).toHaveBeenCalledTimes(1))
    expect(markReadAction).toHaveBeenCalledWith(MESSAGE_ID)
    expect(screen.getByTestId('host')).toBeEmptyDOMElement()
  })

  it('n’envoie « non lu » qu’une fois le marquage lu de l’ouverture réglé', async () => {
    const user = userEvent.setup()
    const calls: string[] = []
    let settleRead: (result: ContactMessageReadActionResult) => void = () => {}
    const markReadAction = vi.fn(
      () =>
        new Promise<ContactMessageReadActionResult>((resolve) => {
          settleRead = (result) => {
            calls.push('read')
            resolve(result)
          }
        })
    )
    const markUnreadAction = vi.fn(async () => {
      calls.push('unread')
      return {status: 'saved' as const}
    })

    render(
      <MarkReadOnOpen messageId={MESSAGE_ID} markReadAction={markReadAction}>
        <ContactMessageDetail
          message={{
            id: MESSAGE_ID,
            organizationId: '22222222-2222-4222-8222-222222222222',
            senderName: 'Claire Meunier',
            senderEmail: 'claire.meunier@example.fr',
            subject: 'Objet',
            body: 'Bonjour',
            read: false,
            notificationFailed: false,
            createdAt: new Date('2026-09-02T12:32:00Z'),
          }}
          markUnreadAction={markUnreadAction}
        />
      </MarkReadOnOpen>
    )
    await waitFor(() => expect(markReadAction).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', {name: 'Marquer comme non lu'}))
    expect(markUnreadAction).not.toHaveBeenCalled()

    settleRead({status: 'saved'})

    expect(await screen.findByText('Marqué comme non lu.')).toBeInTheDocument()
    expect(calls).toEqual(['read', 'unread'])
  })
})
