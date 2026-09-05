import {LucideIcon} from 'lucide-react'

// Types simples pour le menu
export interface MenuItem {
  title: string
  url: string
  icon?: LucideIcon
  isActive?: boolean
  items?: Array<{
    title: string
    url: string
  }>
}

export interface ProjectItem {
  name: string
  url: string
  icon: LucideIcon
}

export interface MenuData {
  adminNavMain: MenuItem[]
  navMain: MenuItem[]
  projects: ProjectItem[]
}

// Fonction principale pour construire le menu - simple et claire
export function buildMenu(menuDataToUse: MenuData, orgSlug: string) {
  // Créer une copie mutable du menu utilisateur avec URLs mises à jour
  const userMenu = menuDataToUse.navMain.map((item: MenuItem) =>
    createMenuItemWithUrls(item, orgSlug)
  )

  // Retourner uniquement le menu utilisateur (adminNavMain sera géré séparément)
  return userMenu
}

// Fonction simple pour remplacer les placeholders dans les URLs
function replaceUrlPlaceholders(url: string, orgSlug: string): string {
  return url.replace('{{orgSlug}}', orgSlug)
}

// Fonction pour créer une copie mutable d'un item avec remplacement d'URL
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMenuItemWithUrls(item: any, orgSlug: string) {
  return {
    ...item,
    url: replaceUrlPlaceholders(item.url, orgSlug),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: item.items?.map((subItem: any) => ({
      ...subItem,
      url: replaceUrlPlaceholders(subItem.url, orgSlug),
    })),
  }
}
