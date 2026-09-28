import {useState} from 'react'
import {describe, expect, it} from 'vitest'

import {render, screen, userEvent} from '@/__tests__/customRender'

import {
  DateField,
  frenchDateToIso,
  isoToFrenchDate,
  maskFrenchDate,
} from './date-field'

function ControlledDateField({
  initial = '',
  error,
}: {
  initial?: string
  error?: string
}) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <label htmlFor="sampled-on">Date du prélèvement</label>
      <DateField
        id="sampled-on"
        value={value}
        onValueChange={setValue}
        placeholder="jj/mm/aaaa"
        error={error}
      />
      <output data-testid="iso">{frenchDateToIso(value) ?? ''}</output>
    </>
  )
}

describe('maskFrenchDate', () => {
  it('insère les barres au fil des chiffres', () => {
    expect(maskFrenchDate('0')).toBe('0')
    expect(maskFrenchDate('02')).toBe('02')
    expect(maskFrenchDate('020')).toBe('02/0')
    expect(maskFrenchDate('02092026')).toBe('02/09/2026')
  })

  it('ignore tout ce qui n’est pas un chiffre et coupe au-delà de huit', () => {
    expect(maskFrenchDate('02//09/2026')).toBe('02/09/2026')
    expect(maskFrenchDate('02/09/20261')).toBe('02/09/2026')
    expect(maskFrenchDate('ab')).toBe('')
  })
})

describe('frenchDateToIso / isoToFrenchDate', () => {
  it('convertit une date complète et existante', () => {
    expect(frenchDateToIso('02/09/2026')).toBe('2026-09-02')
    expect(isoToFrenchDate('2026-09-02')).toBe('02/09/2026')
  })

  it('ne rend rien pour une saisie partielle', () => {
    expect(frenchDateToIso('02/09/20')).toBeUndefined()
    expect(frenchDateToIso('')).toBeUndefined()
  })

  it('refuse une date qui n’existe pas', () => {
    expect(frenchDateToIso('31/02/2026')).toBeUndefined()
    expect(frenchDateToIso('00/09/2026')).toBeUndefined()
    expect(frenchDateToIso('12/13/2026')).toBeUndefined()
  })
})

describe('DateField', () => {
  it('insère les barres à la frappe', async () => {
    const user = userEvent.setup()
    render(<ControlledDateField />)

    const input = screen.getByLabelText('Date du prélèvement')
    await user.type(input, '02092026')

    expect(input).toHaveValue('02/09/2026')
    expect(screen.getByTestId('iso')).toHaveTextContent('2026-09-02')
  })

  it('ne double pas les barres au collage', async () => {
    const user = userEvent.setup()
    render(<ControlledDateField />)

    const input = screen.getByLabelText('Date du prélèvement')
    await user.click(input)
    await user.paste('02/09/2026')

    expect(input).toHaveValue('02/09/2026')
  })

  it('une saisie partielle ne rend pas de valeur ISO', async () => {
    const user = userEvent.setup()
    render(<ControlledDateField />)

    await user.type(screen.getByLabelText('Date du prélèvement'), '020920')

    expect(screen.getByTestId('iso')).toHaveTextContent('')
  })

  it('refuse le 31 février', async () => {
    const user = userEvent.setup()
    render(<ControlledDateField />)

    await user.type(screen.getByLabelText('Date du prélèvement'), '31022026')

    expect(screen.getByTestId('iso')).toHaveTextContent('')
  })

  it('la suppression arrière retraverse une barre', async () => {
    const user = userEvent.setup()
    render(<ControlledDateField initial="02/09" />)

    const input = screen.getByLabelText('Date du prélèvement')
    await user.click(input)
    await user.keyboard('{End}{Backspace}{Backspace}')

    expect(input).toHaveValue('02')
    await user.keyboard('{Backspace}')
    expect(input).toHaveValue('0')
  })

  it('se saisit au clavier numérique, sans calendrier ni bouton', () => {
    render(<ControlledDateField initial="02/09/2026" />)

    const input = screen.getByLabelText('Date du prélèvement')
    expect(input).toHaveAttribute('inputmode', 'numeric')
    expect(input).toHaveAttribute('type', 'text')
    expect(input).toHaveAttribute('placeholder', 'jj/mm/aaaa')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it("l'icône est décorative et jamais focalisable", async () => {
    const user = userEvent.setup()
    const {container} = render(<ControlledDateField />)

    const icon = container.querySelector('svg')
    expect(icon).toHaveAttribute('aria-hidden', 'true')
    expect(icon).not.toHaveAttribute('tabindex')

    await user.tab()
    expect(screen.getByLabelText('Date du prélèvement')).toHaveFocus()
    await user.tab()
    expect(document.body).toHaveFocus()
  })

  it("relie l'erreur au champ", () => {
    render(
      <ControlledDateField
        initial="12/09/2026"
        error="La date du prélèvement ne peut pas être dans le futur."
      />
    )

    const input = screen.getByLabelText('Date du prélèvement')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription(
      'La date du prélèvement ne peut pas être dans le futur.'
    )
  })

  it("n'est pas en erreur sans message", () => {
    render(<ControlledDateField initial="02/09/2026" />)

    const input = screen.getByLabelText('Date du prélèvement')
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(input).not.toHaveAttribute('aria-describedby')
  })
})
