import {DocsBreadcrumb} from '@/components/features/docs/docs-breadcrumb'
import {DocsMenuHeader} from '@/components/features/docs/docs-menu-header'
import {DocsSidebar} from '@/components/features/docs/docs-sidebar'
import {
  TableOfContents,
  TableOfContentsMobile,
} from '@/components/features/docs/table-of-contents'
import {Separator} from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'

import {getDocsStructureAction} from './actions'

interface DocsLayoutProps {
  children: React.ReactNode
  params: Promise<{
    locale: string
  }>
}

export default async function DocsLayout({children, params}: DocsLayoutProps) {
  const resolvedParams = await params
  const docsStructure = await getDocsStructureAction(resolvedParams.locale)
  return (
    <SidebarProvider className="max-w-full overflow-x-hidden">
      <DocsSidebar structure={docsStructure} />
      <SidebarInset className="max-w-full overflow-x-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b">
          <div className="flex items-center gap-2 px-3">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <div className="hidden sm:block">
              <DocsBreadcrumb structure={docsStructure} />
            </div>
          </div>
          <DocsMenuHeader />
        </header>
        <main className="relative flex-1">
          <div className="mx-auto w-full px-2 py-4 md:px-4 xl:max-w-5xl xl:pr-72">
            <TableOfContentsMobile />
            {children}
          </div>
          <TableOfContents />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
