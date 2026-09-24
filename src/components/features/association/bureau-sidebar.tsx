'use client'

import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {useTranslations} from 'next-intl'

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

import {AssociationMark} from './association-mark'

/** Les groupes de la barre laterale, dans l'ordre du design (s04 : « Le site » en tete). */
const NAV_GROUPS = [
  {
    labelKey: 'siteGroup',
    items: [
      {href: '/bureau/pages', labelKey: 'pages'},
      {href: '/bureau/actualites', labelKey: 'news'},
      {href: '/bureau/navigation', labelKey: 'navigation'},
      {href: '/bureau/le-bureau', labelKey: 'board'},
    ],
  },
  {
    labelKey: 'group',
    items: [
      {href: '/bureau/identite', labelKey: 'identity'},
      {href: '/bureau/reglages', labelKey: 'settings'},
    ],
  },
] as const

/** Actif si la route courante est cette page, prefixe de langue ou non. */
const isCurrentPage = (pathname: string, href: string) =>
  pathname === href || pathname.endsWith(href)

type BureauSidebarProps = {
  associationName: string
  logoVersion?: string
}

/**
 * Barre laterale de l'espace bureau (designs s01b, s02 et s04) : identite de
 * l'association en tete, puis « Le site » › Pages, Actualites, Navigation et
 * « L'association » › Identite, Reglages ; l'item actif suit la route. Tiroir
 * sur petit ecran.
 */
export function BureauSidebar({
  associationName,
  logoVersion,
}: BureauSidebarProps) {
  const t = useTranslations('BureauIdentityPage.nav')
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader className="px-5 pt-6">
        <AssociationMark
          name={associationName}
          logoVersion={logoVersion}
          size="backoffice"
        />
      </SidebarHeader>
      <SidebarContent className="pt-6">
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.labelKey}>
            <SidebarGroupLabel className="font-mono text-xs font-semibold tracking-widest uppercase">
              {t(group.labelKey)}
            </SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map(({href, labelKey}) => {
                const isActive = isCurrentPage(pathname, href)
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className="h-11 text-base data-[active=true]:font-semibold"
                    >
                      <Link
                        href={href}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        {t(labelKey)}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  )
}
