'use client'

import {
  Building2,
  CreditCard,
  Key,
  type LucideIcon,
  Mail,
  MoreHorizontal,
  Settings,
  User,
} from 'lucide-react'
import {useTranslations} from 'next-intl'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

export function NavApplication({
  applications,
}: {
  applications: {
    name: string
    url: string
    icon: LucideIcon
  }[]
}) {
  const {isMobile} = useSidebar()
  const t = useTranslations('AppSidebar')

  // Menu items pour le dropdown des applications front
  const accountMenuItems = [
    {
      title: t('account.accountAndSecurity'),
      url: '/account',
      icon: User,
    },
    {
      title: t('account.settings'),
      url: '/account/settings',
      icon: Settings,
    },
    {
      title: t('account.apiKeys'),
      url: '/account/api-keys',
      icon: Key,
    },
    {
      title: t('account.subscriptions'),
      url: '/account/billing/subscription',
      icon: CreditCard,
    },
    {
      title: t('account.organizations'),
      url: '/account/organizations',
      icon: Building2,
    },
    {
      title: t('account.invitations'),
      url: '/account/invitations',
      icon: Mail,
    },
  ]

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Applications</SidebarGroupLabel>
      <SidebarMenu>
        {applications.map((item) => (
          <SidebarMenuItem key={item.name}>
            <SidebarMenuButton asChild>
              <a href={item.url}>
                <item.icon />
                <span>{item.name}</span>
              </a>
            </SidebarMenuButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuAction showOnHover>
                  <MoreHorizontal />
                  <span className="sr-only">More</span>
                </SidebarMenuAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-48 rounded-lg"
                side={isMobile ? 'bottom' : 'right'}
                align={isMobile ? 'end' : 'start'}
              >
                {accountMenuItems.map((menuItem) => (
                  <DropdownMenuItem
                    key={menuItem.title}
                    asChild
                    className="cursor-pointer"
                  >
                    <a href={menuItem.url}>
                      <menuItem.icon className="text-muted-foreground" />
                      <span>{menuItem.title}</span>
                    </a>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
