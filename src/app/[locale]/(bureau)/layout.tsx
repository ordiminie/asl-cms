import type {Metadata} from 'next'
import React, {Suspense} from 'react'

import {canManageCurrentAssociationIdentityDal} from '@/app/dal/association-identity-dal'
import {isPlainMemberOfCurrentAssociationDal} from '@/app/dal/member-space-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {AssociationMark} from '@/components/features/association/association-mark'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {BureauMenuButton} from '@/components/features/association/bureau-menu-button'
import {BureauSidebar} from '@/components/features/association/bureau-sidebar'
import {MemberSpaceAccessDenied} from '@/components/features/association/member-space-access-denied'
import {SidebarInset, SidebarProvider} from '@/components/ui/sidebar'
import {NO_INDEX_ROBOTS} from '@/lib/seo/resolve-metadata'
import {getIdentityVersionFromKey} from '@/services/types/domain/association-identity-types'

/** Back-office : jamais dans les moteurs (s11, critere 3). */
export const metadata: Metadata = {robots: NO_INDEX_ROBOTS}

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
 * (ou le SuperAdmin) ; tout autre utilisateur voit un ecran de refus, sans
 * aucune rubrique d'administration : un proprietaire de l'association l'ecran
 * C4, qui le renvoie a son espace (s12d), tout autre compte le refus de s01b.
 */
async function BureauShell({children}: {children: React.ReactNode}) {
  const [tenant, allowed, plainMember] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentAssociationIdentityDal(),
    isPlainMemberOfCurrentAssociationDal(),
  ])

  if (!allowed) {
    return (
      <main className="bg-background min-h-screen">
        {plainMember ? <MemberSpaceAccessDenied /> : <BureauAccessDenied />}
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
