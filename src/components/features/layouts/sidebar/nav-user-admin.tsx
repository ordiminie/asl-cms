'use client'

import {
  BadgeCheck,
  ChevronsUpDown,
  LogOut,
  Moon,
  Settings,
  Sun,
} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {useTheme} from 'next-themes'

import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import {PagesConst} from '@/env'
import {isPageEnabled} from '@/lib/utils'
import {User} from '@/services/types/domain/user-types'

export function NavUserAdmin({user}: {user?: User}) {
  const t = useTranslations('NavUser')
  const {isMobile} = useSidebar()
  const {theme, setTheme} = useTheme()

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user?.image ?? ''} alt={user?.name ?? ''} />
                <AvatarFallback className="rounded-lg">CN</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{user?.name}</span>
                <span className="truncate text-xs">{user?.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user?.image ?? ''} alt={user?.name ?? ''} />
                  <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{user?.name}</span>
                  <span className="truncate text-xs">{user?.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={toggleTheme}
                className="cursor-pointer"
              >
                {theme === 'light' ? (
                  <>
                    <Moon
                      className="h-[1.2rem] w-[1.2rem]"
                      suppressHydrationWarning
                    />
                    {t('darkMode')}
                  </>
                ) : (
                  <>
                    <Sun
                      className="h-[1.2rem] w-[1.2rem]"
                      suppressHydrationWarning
                    />
                    {t('lightMode')}
                  </>
                )}
              </DropdownMenuItem>
              {isPageEnabled(PagesConst.ACCOUNT) && (
                <DropdownMenuItem>
                  <BadgeCheck />
                  <Link href="/account">{t('account')}</Link>
                </DropdownMenuItem>
              )}
              {isPageEnabled(PagesConst.SETTINGS) && (
                <DropdownMenuItem>
                  <Settings />
                  <Link href="/account/settings">{t('settings')}</Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <LogOut />
              <Link href="/logout">{t('logout')}</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
