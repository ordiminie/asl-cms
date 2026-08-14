import withAuth from '@/components/features/auth/with-auth'
import DashboardPage from '@/components/features/dashboard/dashboard'

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false

function Page() {
  return <DashboardPage />
}

export default withAuth(Page)
