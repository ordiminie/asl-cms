import {Metadata} from 'next'
import React from 'react'

import AuthProvider from '@/components/context/auth-provider'
import {OrganizationProvider} from '@/components/context/organization-provider'
import {AppBreadcrumb} from '@/components/features/app-breadcrumb'
import withAuth from '@/components/features/auth/with-auth'
import {AppSidebar} from '@/components/features/layouts/sidebar/app-sidebar'
import {QuickFeedbackButton} from '@/components/features/quick-feedback-button'
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

export const metadata: Metadata = {
  title: `Espace utilisateur ${APP_NAME}`,
  description: "Page d'espace utilisateur",
}

async function AppLayout({children}: {children: React.ReactNode}) {
  const user = await getAuthUser()
  const sessionAuth = await getSessionAuth()

  const organizationId = sessionAuth?.session?.activeOrganizationId
  const activeOrganization = user?.organizations?.find(
    (org) => org.organization?.id === organizationId
  )?.organization

  return (
    <AuthProvider initialUser={user} initialSession={sessionAuth?.session}>
      <OrganizationProvider initialOrganization={activeOrganization}>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <div className="flex min-h-screen flex-col">
              <main className="flex-1">
                <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
                  <div className="flex h-14 items-center gap-2">
                    <SidebarTrigger />
                    <AppBreadcrumb />
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

export default withAuth(AppLayout)
