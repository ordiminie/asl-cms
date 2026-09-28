import {describe, expect, it} from 'vitest'

import {render} from '@/__tests__/customRender'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from './alert-dialog'
import {Dialog, DialogContent, DialogDescription, DialogTitle} from './dialog'

/**
 * Le voile d'un dialogue modal est le token `--overlay` (design system §1.9),
 * une valeur par theme : du noir a 50 % ne separe rien sur un fond sombre.
 */
describe('voile des dialogues modaux', () => {
  it("l'alert-dialog pose le token --overlay, jamais un noir écrit en dur", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>Titre</AlertDialogTitle>
          <AlertDialogDescription>Description</AlertDialogDescription>
        </AlertDialogContent>
      </AlertDialog>
    )

    const overlay = document.querySelector('[data-slot="alert-dialog-overlay"]')
    expect(overlay).toHaveClass('bg-overlay')
    expect(overlay?.className).not.toMatch(/bg-black/)
    expect(
      document.querySelector('[data-slot="alert-dialog-content"]')
    ).toHaveClass('border')
  })

  it('le dialogue partage le même voile', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Titre</DialogTitle>
          <DialogDescription>Description</DialogDescription>
        </DialogContent>
      </Dialog>
    )

    const overlay = document.querySelector('[data-slot="dialog-overlay"]')
    expect(overlay).toHaveClass('bg-overlay')
    expect(overlay?.className).not.toMatch(/bg-black/)
  })
})
