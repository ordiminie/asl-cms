import withAuth from '@/components/features/auth/with-auth'
import DashboardPage from '@/components/features/dashboard/dashboard'

// Route authentifiée : le layout lit la session via getAuthUser() -> headers() et la
// passe à AuthProvider, qui enveloppe tout l'arbre. Aucun enfant à isoler dans un
// <Suspense> — c'est le cas que la doc Next appelle « no child to wrap ». Lever cet
// opt-out demande de revoir comment AuthProvider obtient l'utilisateur (D16).
export const instant = false

function Page() {
  return <DashboardPage />
}

export default withAuth(Page)
