import {render, screen} from '@testing-library/react'
import {describe, expect, it} from 'vitest'

import {Table, TableBody, TableCell, TableRow} from './table'

describe('TableRow (design system §1.9)', () => {
  it('zèbre et survole avec les tokens du tableau du bureau', () => {
    render(
      <Table>
        <TableBody>
          <TableRow data-testid="row">
            <TableCell>ligne</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )
    const row = screen.getByTestId('row')
    expect(row).toHaveClass('even:bg-table-stripe', 'hover:bg-table-row-hover')
    expect(row).not.toHaveClass('hover:bg-muted/50')
  })
})
