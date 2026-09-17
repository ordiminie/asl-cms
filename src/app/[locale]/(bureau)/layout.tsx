import React, {Suspense} from 'react'

import {canManageCurrentAssociationIdentityDal} from '@/app/dal/association-identity-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {AssociationMark} from '@/components/features/association/association-mark'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {BureauMenuButton} from '@/components/features/association/bureau-menu-button'
import {BureauSidebar} from '@/components/features/association/bureau-sidebar'
import {SidebarInset, SidebarProvider} from '@/components/ui/sidebar'
import {getIdentityVersionFromKey} from '@/services/types/domain/association-identity-types'

/**
 * Espace bureau de l'association (s01b). La session n'est jamais attendue en
 * tete du layout : le controle d'acces est lu derriere un `<Suspense>`.
 */
export default function BureauLayout({children}: {children: React.ReactNode}) {
  return (
    <Suspense fallback={null}>
      <BureauShell>{children}</BureauShell>
    </Suspense>
  )
}

/**
 * Barre laterale seulement pour le bureau de l'association du domaine appele
 * (ou le SuperAdmin) ; tout autre utilisateur voit l'ecran de refus, sans
 * aucune rubrique d'administration.
 */
async function BureauShell({children}: {children: React.ReactNode}) {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentAssociationIdentityDal(),
  ])

  if (!allowed) {
    return (
      <main className="bg-background min-h-screen">
        <BureauAccessDenied />
      </main>
    )
  }

  const logoVersion = getIdentityVersionFromKey(tenant.logoKey)

  return (
    <SidebarProvider>
      <BureauSidebar associationName={tenant.name} logoVersion={logoVersion} />
      <SidebarInset>
        <header className="bg-sidebar flex h-16 items-center justify-between gap-3 border-b px-4 md:hidden">
          <AssociationMark
            name={tenant.name}
            logoVersion={logoVersion}
            size="backoffice"
            className="min-w-0"
          />
          <BureauMenuButton />
        </header>
        <main className="flex-1">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
