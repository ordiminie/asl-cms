'use client'

import {Calendar} from 'lucide-react'
import * as React from 'react'

import {cn} from '@/lib/utils'

import {maskFrenchDate} from './date-field-format'
import {Input} from './input'

export {
  frenchDateToIso,
  isoToFrenchDate,
  maskFrenchDate,
} from './date-field-format'

type DateFieldProps = Omit<
  React.ComponentProps<'input'>,
  'type' | 'value' | 'onChange' | 'inputMode'
> & {
  id: string
  /** La valeur affichee, au format `jj/mm/aaaa` (eventuellement partielle). */
  value: string
  onValueChange: (value: string) => void
  /** Message d'erreur ecrit sous le champ, relie par `aria-describedby`. */
  error?: string
}

/**
 * Champ date du design system (§3.9) : saisie au clavier seule, **sans
 * calendrier deroulant** — les dates saisies dans le produit sont proches
 * d'aujourd'hui. Masque `jj/mm/aaaa` a la frappe, clavier numerique, chiffres
 * en JetBrains Mono 500. L'icone `Calendar` est decorative : jamais un bouton,
 * jamais focalisable.
 */
export function DateField({
  id,
  value,
  onValueChange,
  error,
  className,
  'aria-describedby': describedBy,
  ...props
}: DateFieldProps) {
  const errorId = `${id}-error`
  const descriptions = [describedBy, error ? errorId : undefined]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="flex flex-col gap-2">
      <div className="relative w-full max-w-60">
        <Input
          {...props}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={descriptions || undefined}
          className={cn(
            'h-14 pr-11 font-mono text-[18px] font-medium tabular-nums lg:h-12 lg:text-[17px]',
            'focus-visible:ring-ring/40 focus-visible:ring-2',
            'aria-invalid:border-2',
            className
          )}
          onChange={(event) =>
            onValueChange(maskFrenchDate(event.target.value))
          }
        />
        <Calendar
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2"
        />
      </div>
      {error && (
        <p
          id={errorId}
          className="text-destructive-text text-[16px] font-medium"
        >
          {error}
        </p>
      )}
    </div>
  )
}
