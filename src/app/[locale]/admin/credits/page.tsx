import {AdminGrantCreditsForm} from '@/components/features/admin/credits/admin-grant-credits-form'

// Route authentifiée, pas encore migrée. Le layout fait un `await` sur la session à son
// niveau supérieur, ce qui bloque tout le segment. Le pattern officiel existe :
// https://nextjs.org/docs/app/guides/authentication-with-cache-components
// (session en 'use cache: private', promesse passée au provider, use() derrière Suspense).
// Voir D17 dans docs/plans/cache-components-migration.md.
export const instant = false

export default function AdminCreditsPage() {
  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Gestion des crédits</h1>
        <p className="text-muted-foreground">
          Accordez des crédits aux organisations
        </p>
      </div>

      <div className="max-w-2xl">
        <AdminGrantCreditsForm />
      </div>
    </div>
  )
}
