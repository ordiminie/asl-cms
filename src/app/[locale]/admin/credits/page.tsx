import {AdminGrantCreditsForm} from '@/components/features/admin/credits/admin-grant-credits-form'

// Route authentifiée : le layout lit la session via getAuthUser() -> headers() et la
// passe à AuthProvider, qui enveloppe tout l'arbre. Aucun enfant à isoler dans un
// <Suspense> — c'est le cas que la doc Next appelle « no child to wrap ». Lever cet
// opt-out demande de revoir comment AuthProvider obtient l'utilisateur (D16).
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
