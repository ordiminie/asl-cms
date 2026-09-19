import {describe, expect, it} from 'vitest'

import {buttonVariants} from './button'

describe('buttonVariants — survol hors teinte de l association (§1.2)', () => {
  it.each(['outline', 'ghost'] as const)(
    '%s survole en secondary, jamais en accent',
    (variant) => {
      const classes = buttonVariants({variant})

      expect(classes).not.toContain('hover:bg-accent')
      expect(classes).not.toContain('hover:text-accent-foreground')
      expect(classes).toContain('hover:bg-secondary')
      expect(classes).toContain('hover:text-secondary-foreground')
    }
  )
})
