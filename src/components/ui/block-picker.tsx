'use client'

import {Plus} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useState} from 'react'

import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover'

/**
 * Selecteur de bloc (design system §2.5).
 *
 * Cinq types, jamais plus : pas de categorie, pas d'onglet, pas de defilement
 * cache. Le separateur d'insertion reste visible en permanence entre deux
 * blocs — une action qui n'apparait qu'au survol n'existe pas au tactile.
 */
export type BlockPickerType = {
  value: string
  label: string
  description: string
}

type BlockPickerProps = {
  types: BlockPickerType[]
  insertAt: number
  onInsert: (type: string, insertAt: number) => void
  /** Libelle du declencheur : separateur entre deux blocs, ou bouton de fin. */
  trigger: 'separator' | 'append'
  searchable?: boolean
}

export function BlockPicker({
  types,
  insertAt,
  onInsert,
  trigger,
  searchable = true,
}: BlockPickerProps) {
  const t = useTranslations('BlockPicker')
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const visibleTypes = types.filter((type) =>
    type.label.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr'))
  )

  const insert = (type: string) => {
    onInsert(type, insertAt)
    setSearch('')
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={
            trigger === 'separator'
              ? 'text-muted-foreground h-11 w-full border-dashed'
              : 'h-14 w-full'
          }
        >
          <Plus aria-hidden="true" className="size-4" />
          {t(trigger === 'separator' ? 'insertHere' : 'append')}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="center" className="w-[22rem] p-2">
        {searchable && (
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchLabel')}
            className="mb-2"
          />
        )}

        <ul className="flex list-none flex-col gap-1 p-0">
          {visibleTypes.map((type) => (
            <li key={type.value}>
              <button
                type="button"
                onClick={() => insert(type.value)}
                className="hover:bg-accent hover:text-accent-foreground flex min-h-14 w-full flex-col items-start gap-1 rounded-md px-3 py-2 text-left"
              >
                <span className="font-semibold">{type.label}</span>
                <span className="text-muted-foreground text-[14px]">
                  {type.description}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {visibleTypes.length === 0 && (
          <p className="text-muted-foreground px-3 py-2 text-[14px]">
            {t('noResult')}
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}
