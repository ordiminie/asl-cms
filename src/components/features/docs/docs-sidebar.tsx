'use client'

import {GalleryVerticalEnd, Search} from 'lucide-react'
import Link from 'next/link'
import {usePathname} from 'next/navigation'
import * as React from 'react'

import {SearchModal} from '@/components/features/docs/search-modal'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from '@/components/ui/sidebar'

// Types are now passed as props from server components
export interface DocItem {
  title: string
  slug: string
  href: string
  type: 'file' | 'directory'
  order: number
  description?: string
  children?: DocItem[]
}

export interface DocsStructure {
  items: DocItem[]
}

interface DocsSidebarProps {
  structure: DocsStructure
}

// Transformer la structure de docs en format compatible avec AppSidebar
function transformDocsToNavStructure(structure: DocsStructure) {
  return structure.items.map((item: DocItem) => ({
    title: item.title,
    url: item.href,
    items:
      item.children?.map((child: DocItem) => ({
        title: child.title,
        url: child.href,
        isActive: false, // sera défini dynamiquement
      })) || [],
  }))
}

export function DocsSidebar({
  structure,
  ...props
}: DocsSidebarProps & React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const navMain = transformDocsToNavStructure(structure)
  const [searchOpen, setSearchOpen] = React.useState(false)

  return (
    <Sidebar {...props}>
      <SidebarHeader className="border-sidebar-border border-b">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-sm">
                  <GalleryVerticalEnd className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-medium">ShipSaaS</span>
                  <span className="">Documentation</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <div className="px-3 py-2">
        <button
          onClick={() => setSearchOpen(true)}
          className="text-muted-foreground bg-muted/50 hover:bg-muted/70 relative flex w-full items-center rounded-md px-3 py-2 text-sm transition-colors"
        >
          <Search className="mr-2 h-4 w-4" />
          <span className="flex-1 text-left">Search documentation...</span>
          <kbd className="bg-muted text-muted-foreground pointer-events-none inline-flex h-5 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium select-none">
            <span className="text-xs">⌘K</span>
          </kbd>
        </button>
      </div>

      <SearchModal open={searchOpen} onOpenChange={setSearchOpen} />
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {navMain.map((item) => {
              // Extract last part of current pathname and item URL for comparison
              const currentPageSlug = pathname.split('/').pop() || ''
              const itemSlug = item.url.split('/').pop() || ''

              // Check if current page matches this item directly (not children)
              const isItemActive = currentPageSlug === itemSlug

              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link
                      href={item.url}
                      className={`font-medium whitespace-nowrap ${
                        isItemActive
                          ? 'text-foreground border-primary bg-accent/50 border-l-2 pl-2'
                          : ''
                      }`}
                    >
                      {item.title}
                    </Link>
                  </SidebarMenuButton>
                  {item.items?.length ? (
                    <SidebarMenuSub>
                      {item.items.map((_item) => {
                        const childSlug = _item.url.split('/').pop() || ''
                        const isChildActive = currentPageSlug === childSlug

                        return (
                          <SidebarMenuSubItem key={_item.title}>
                            <SidebarMenuSubButton asChild>
                              <Link
                                href={_item.url}
                                className={`whitespace-nowrap ${
                                  isChildActive
                                    ? 'text-foreground border-primary bg-accent/30 border-l-2 pl-3 font-medium'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                {_item.title}
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        )
                      })}
                    </SidebarMenuSub>
                  ) : undefined}
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
