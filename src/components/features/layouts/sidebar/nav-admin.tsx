'use client'

import {
  BookOpen,
  Building2,
  CreditCard,
  type LucideIcon,
  MoreHorizontal,
  Users,
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

export function NavAdmin({
  adminItems,
}: {
  adminItems: {
    title: string
    url: string
    icon?: LucideIcon
  }[]
}) {
  const {isMobile} = useSidebar()
  const t = useTranslations('AppSidebar')

  // Menu items pour le dropdown admin
  const adminMenuItems = [
    {
      title: t('admin.users'),
      url: '/admin/users',
      icon: Users,
    },
    {
      title: t('admin.organizations'),
      url: '/admin/organizations',
      icon: Building2,
    },
    {
      title: t('admin.plans'),
      url: '/admin/plans',
      icon: CreditCard,
    },
    {
      title: t('admin.blog'),
      url: '/admin/blog',
      icon: BookOpen,
    },
  ]

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Administration</SidebarGroupLabel>
      <SidebarMenu>
        {adminItems.map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton asChild>
              <a href={item.url}>
                {item.icon && <item.icon />}
                <span>{item.title}</span>
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
                {adminMenuItems.map((menuItem) => (
                  <DropdownMenuItem key={menuItem.title} asChild>
                    <a href={menuItem.url} className="cursor-pointer">
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
