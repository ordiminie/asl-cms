import {Metadata} from 'next'

import {getAppSettingsGroupedDal} from '@/app/dal/app-settings-dal'
import {withAuthAdmin} from '@/components/features/auth/with-auth'

import SettingsForm from './settings-form'

// Route authentifiée, pas encore migrée. Le layout fait un `await` sur la session à son
// niveau supérieur, ce qui bloque tout le segment. Le pattern officiel existe :
// https://nextjs.org/docs/app/guides/authentication-with-cache-components
// (session en 'use cache: private', promesse passée au provider, use() derrière Suspense).
// Voir D17 dans docs/plans/cache-components-migration.md.
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
