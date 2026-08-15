import withAuth from '@/components/features/auth/with-auth'
import DashboardPage from '@/components/features/dashboard/dashboard'

// Route authentifiée, pas encore migrée. Le layout fait un `await` sur la session à son
// niveau supérieur, ce qui bloque tout le segment. Le pattern officiel existe :
// https://nextjs.org/docs/app/guides/authentication-with-cache-components
// (session en 'use cache: private', promesse passée au provider, use() derrière Suspense).
// Voir D17 dans docs/plans/cache-components-migration.md.
export const instant = false

function Page() {
  return <DashboardPage />
}

export default withAuth(Page)
