import {useTranslations} from 'next-intl'

import {RecoveryCodeForm} from '@/components/features/auth/forms/recovery-code-form'

export default function RecoveryCodePage() {
  const t = useTranslations('Auth.RecoveryCodePage')

  return (
    <div className="relative container grid min-h-screen flex-col items-center justify-center lg:max-w-none lg:grid-cols-2 lg:px-0">
      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              {t('title')}
            </h1>
            <p className="text-muted-foreground text-sm">{t('description')}</p>
          </div>
          <RecoveryCodeForm />
        </div>
      </div>
    </div>
  )
}
