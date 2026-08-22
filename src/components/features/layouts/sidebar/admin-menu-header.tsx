'use client'

import {Settings} from 'lucide-react'
import {useTranslations} from 'next-intl'
import * as React from 'react'

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

export function AdminMenuHeader() {
  const t = useTranslations('AppSidebar.nav')
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-red-600 text-white">
            <Settings className="size-4" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-bold text-red-600">
              {t('adminLabel')}
            </span>
            <span className="text-muted-foreground truncate text-xs">
              {t('adminPanel')}
            </span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
