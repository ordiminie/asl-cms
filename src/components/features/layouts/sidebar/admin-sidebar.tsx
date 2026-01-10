'use client'

import {Frame, Settings2, SquareTerminal} from 'lucide-react'
import * as React from 'react'

import {AdminMenuHeader} from '@/components/features/layouts/sidebar/admin-menu-header'
import {NavMain} from '@/components/features/layouts/sidebar/nav-main'
import {NavUserAdmin} from '@/components/features/layouts/sidebar/nav-user-admin'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import {User} from '@/services/types/domain/user-types'

import {NavApplication} from './nav-application'

// This is sample data.
const data = {
  navMain: [
    {
      title: 'Administration',
      url: '#',
      icon: SquareTerminal,
      isActive: true,
      items: [
        {
          title: 'Dashboard Admin',
          url: '/admin',
        },
        {
          title: 'Utilisateurs',
          url: '/admin/users',
        },
        {
          title: 'Organizations',
          url: '/admin/organizations',
        },
        {
          title: 'Plans',
          url: '/admin/plans',
        },
        {
          title: 'Abonnements',
          url: '/admin/subscriptions',
        },
        {
          title: 'Blog',
          url: '/admin/blog',
        },
        {
          title: 'Crédits',
          url: '/admin/credits',
        },
      ],
    },

    {
      title: 'Settings',
      url: '#',
      icon: Settings2,
      items: [
        {
          title: 'General',
          url: '#',
        },
        {
          title: 'Team',
          url: '#',
        },
        {
          title: 'Billing',
          url: '#',
        },
        {
          title: 'Limits',
          url: '#',
        },
      ],
    },
  ],
  appNavMain: [
    {
      name: 'Application (front office)',
      url: '/dashboard',
      icon: Frame,
    },
  ],
}

export function AdminSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {user?: User}) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <AdminMenuHeader />
      </SidebarHeader>
      <SidebarContent>
        <NavApplication applications={data.appNavMain} />
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUserAdmin user={user || undefined} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
