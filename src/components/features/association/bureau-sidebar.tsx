import Link from 'next/link'
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

type BureauSidebarProps = {
  associationName: string
  logoVersion?: string
}

/**
 * Barre laterale de l'espace bureau (design s01b) : identite de l'association
 * en tete, groupe « L'association » › Identite. Tiroir sur petit ecran.
 */
export function BureauSidebar({
  associationName,
  logoVersion,
}: BureauSidebarProps) {
  const t = useTranslations('BureauIdentityPage.nav')

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
        <SidebarGroup>
          <SidebarGroupLabel className="font-mono text-xs font-semibold tracking-widest uppercase">
            {t('group')}
          </SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive
                className="h-11 text-base data-[active=true]:font-semibold"
              >
                <Link href="/bureau/identite" aria-current="page">
                  {t('identity')}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
