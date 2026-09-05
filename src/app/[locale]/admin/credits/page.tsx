import {useTranslations} from 'next-intl'

import {AdminGrantCreditsForm} from '@/components/features/admin/credits/admin-grant-credits-form'

export default function AdminCreditsPage() {
  const t = useTranslations('AdminPages')
  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{t('creditsTitle')}</h1>
        <p className="text-muted-foreground">{t('creditsDescription')}</p>
      </div>

      <div className="max-w-2xl">
        <AdminGrantCreditsForm />
      </div>
    </div>
  )
}
