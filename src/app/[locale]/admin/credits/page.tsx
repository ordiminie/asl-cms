import {AdminGrantCreditsForm} from '@/components/features/admin/credits/admin-grant-credits-form'

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
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
