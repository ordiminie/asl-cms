import {Metadata} from 'next'

import {getAppSettingsGroupedDal} from '@/app/dal/app-settings-dal'
import {withAuthAdmin} from '@/components/features/auth/with-auth'

import SettingsForm from './settings-form'

// Route authentifiée : le layout lit la session via getAuthUser() -> headers() et la
// passe à AuthProvider, qui enveloppe tout l'arbre. Aucun enfant à isoler dans un
// <Suspense> — c'est le cas que la doc Next appelle « no child to wrap ». Lever cet
// opt-out demande de revoir comment AuthProvider obtient l'utilisateur (D16).
export const instant = false

export const metadata: Metadata = {
  title: 'Settings',
  description: "Paramètres globaux de l'application",
}

async function SettingsPage() {
  const settingsGrouped = await getAppSettingsGroupedDal()

  return (
    <div className="bg-background">
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Application Settings
          </h1>
          <p className="text-muted-foreground">
            Configurez les paramètres globaux de l&apos;application
          </p>
        </div>

        <SettingsForm settingsGrouped={settingsGrouped} />
      </div>
    </div>
  )
}

export default withAuthAdmin(SettingsPage)
