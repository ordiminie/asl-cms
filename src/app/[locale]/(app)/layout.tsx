import {Metadata} from 'next'
import React, {Suspense} from 'react'

import {getCurrentUserDal} from '@/app/dal/user-dal'
import AuthProvider from '@/components/context/auth-provider'
import {OrganizationProvider} from '@/components/context/organization-provider'
import {OrganizationSync} from '@/components/context/organization-sync'
import {UserPreferencesSync} from '@/components/context/user-preferences-sync'
import {AppBreadcrumb} from '@/components/features/app-breadcrumb'
import {AppSidebar} from '@/components/features/layouts/sidebar/app-sidebar'
import {SidebarSkeleton} from '@/components/features/layouts/sidebar/sidebar-skeleton'
import {QuickFeedbackButton} from '@/components/features/quick-feedback-button'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import {APP_NAME} from '@/lib/constants'

export const metadata: Metadata = {
  title: `Espace utilisateur ${APP_NAME}`,
  description: "Page d'espace utilisateur",
}

export default function AppLayout({children}: {children: React.ReactNode}) {
  // La promesse est créée, jamais attendue : un `await` ici tiendrait tout le
  // segment derrière la requête, {children} compris. Ce sont les composants
  // placés derrière un <Suspense> qui la déroulent.
  const userPromise = getCurrentUserDal()

  return (
    <AuthProvider userPromise={userPromise}>
      <OrganizationProvider>
        <Suspense fallback={null}>
          <UserPreferencesSync />
          <OrganizationSync />
        </Suspense>
        <SidebarProvider>
          <Suspense fallback={<SidebarSkeleton />}>
            <AppSidebar />
          </Suspense>
          <SidebarInset>
            <div className="flex min-h-screen flex-col">
              <main className="flex-1">
                <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
                  <div className="flex h-14 items-center gap-2">
                    <SidebarTrigger />
                    {/* usePathname() : sur les routes à params inconnus au
                        prerender (team/[slug]), le chemin n'existe qu'à la
                        requête. */}
                    <Suspense fallback={null}>
                      <AppBreadcrumb />
                    </Suspense>
                    <div className="ml-auto">
                      <QuickFeedbackButton />
                    </div>
                  </div>
                  <div className="pt-6 pb-8">{children}</div>
                </div>
              </main>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </OrganizationProvider>
    </AuthProvider>
  )
}
