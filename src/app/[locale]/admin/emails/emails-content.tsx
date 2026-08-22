import {useTranslations} from 'next-intl'

import {EMAIL_REGISTRY} from '@/lib/emails/email-registry'

import EmailsTestForm from './emails-test-form'

export default function EmailsContent() {
  const t = useTranslations('AdminPages')
  return (
    <div className="container mx-auto space-y-6 py-6">
      <div>
        <h1 className="text-3xl font-bold">{t('emailsTitle')}</h1>
        <p className="text-muted-foreground">{t('emailsDescription')}</p>
      </div>
      <EmailsTestForm emailRegistry={EMAIL_REGISTRY} />
    </div>
  )
}
