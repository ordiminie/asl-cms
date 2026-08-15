import {Metadata} from 'next'
import React from 'react'

import AuthProvider from '@/components/context/auth-provider'
import {AppBreadcrumb} from '@/components/features/app-breadcrumb'
import {withAuthAdmin} from '@/components/features/auth/with-auth'
import {AdminSidebar} from '@/components/features/layouts/sidebar/admin-sidebar'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import {APP_NAME} from '@/lib/constants'
import {
  getAuthUser,
  getSessionAuth,
} from '@/services/authentication/auth-service'

// Route authentifiée, pas encore migrée. Le layout fait un `await` sur la session à son
// niveau supérieur, ce qui bloque tout le segment. Le pattern officiel existe :
// https://nextjs.org/docs/app/guides/authentication-with-cache-components
// (session en 'use cache: private', promesse passée au provider, use() derrière Suspense).
// Voir D17 dans docs/plans/cache-components-migration.md.
export const instant = false

export const metadata: Metadata = {
  title: `Espace administrateur ${APP_NAME}`,
  description: "Page d'espace administrateur",
}

async function AppLayout({children}: {children: React.ReactNode}) {
  const user = await getAuthUser()
  const sessionAuth = await getSessionAuth()
  return (
    <AuthProvider initialUser={user} initialSession={sessionAuth?.session}>
      <SidebarProvider>
        <AdminSidebar user={user} />
        <SidebarInset>
          <div className="flex min-h-screen flex-col">
            <main className="flex-1">
              <div className="mx-auto w-full max-w-7xl px-4">
                <div className="flex h-14 items-center gap-2">
                  <SidebarTrigger />
                  <AppBreadcrumb />
                </div>
                <div className="pt-4 pb-6">{children}</div>
              </div>
            </main>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AuthProvider>
  )
}

export default withAuthAdmin(AppLayout)
