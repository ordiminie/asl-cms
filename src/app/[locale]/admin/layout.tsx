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

// Route authentifiée : le layout lit la session via getAuthUser() -> headers() et la
// passe à AuthProvider, qui enveloppe tout l'arbre. Aucun enfant à isoler dans un
// <Suspense> — c'est le cas que la doc Next appelle « no child to wrap ». Lever cet
// opt-out demande de revoir comment AuthProvider obtient l'utilisateur (D16).
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
