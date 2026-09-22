'use client'

import {Menu} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'

import {Button} from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {PublicMenuEntryDTO} from '@/services/types/domain/site-navigation-types'

/**
 * Tiroir du site public sur petit ecran (s04b, ecran 2). Il porte **les memes
 * entrees que la navigation d'ordinateur**, dans le meme ordre : une seule
 * source, donc pas de divergence entre les deux tailles d'ecran. La connexion
 * reste toujours accessible, menu vide compris.
 */
export function PublicMobileMenu({entries}: {entries: PublicMenuEntryDTO[]}) {
  const t = useTranslations('PublicMobileMenu')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Menu className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">{t('toggle')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {entries.map((entry) => (
          <DropdownMenuItem key={entry.id} asChild>
            <Link href={`/${entry.slug}`}>{entry.title}</Link>
          </DropdownMenuItem>
        ))}
        {entries.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem asChild>
          <Link href="/login">{t('login')}</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
