'use client'

import {Landmark} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

/**
 * Entree « Back-office de l'association » de la barre de /admin (s46) : meme
 * hote, meme cookie, `/bureau` s'ouvre sans nouvelle connexion. Rendue
 * seulement quand le domaine appele sert une association.
 */
export function NavApplication({association}: {association?: {name: string}}) {
  const t = useTranslations('AppSidebar.associationBackOffice')

  if (!association) {
    return null
  }

  const label = t('ariaLabel', {name: association.name})

  return (
    <SidebarGroup>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild size="lg" tooltip={label}>
            <Link href="/bureau" aria-label={label}>
              <Landmark />
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate font-semibold">{t('label')}</span>
                <span className="text-muted-foreground truncate text-[15px]">
                  {association.name}
                </span>
              </span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  )
}
