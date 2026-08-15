import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from '@/components/ui/sidebar'

const SKELETON_ITEMS = ['header', 'main', 'projects', 'settings', 'footer']

/**
 * Fallback de la sidebar pendant que la session se résout. Occupe la même
 * largeur que la vraie sidebar pour que le contenu ne se décale pas.
 */
export function SidebarSkeleton() {
  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarMenu>
          {SKELETON_ITEMS.map((item) => (
            <SidebarMenuItem key={item}>
              <SidebarMenuSkeleton showIcon />
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  )
}
