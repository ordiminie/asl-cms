import withAuth from '@/components/features/auth/with-auth'
import DashboardPage from '@/components/features/dashboard/dashboard'

function Page() {
  return <DashboardPage />
}

export default withAuth(Page)
