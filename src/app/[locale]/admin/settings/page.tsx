import {Metadata} from 'next'
import {getTranslations} from 'next-intl/server'

import {getAppSettingsGroupedDal} from '@/app/dal/app-settings-dal'
import {withAuthAdmin} from '@/components/features/auth/with-auth'

import SettingsForm from './settings-form'

export const metadata: Metadata = {
  title: 'Settings',
  description: "Paramètres globaux de l'application",
}

async function SettingsPage() {
  const t = await getTranslations('AdminPages')
  const settingsGrouped = await getAppSettingsGroupedDal()

  return (
    <div className="bg-background">
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('settingsTitle')}
          </h1>
          <p className="text-muted-foreground">{t('settingsDescription')}</p>
        </div>

        <SettingsForm settingsGrouped={settingsGrouped} />
      </div>
    </div>
  )
}

export default withAuthAdmin(SettingsPage)
