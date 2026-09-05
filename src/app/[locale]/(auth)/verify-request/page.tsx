import {useTranslations} from 'next-intl'

import {Card, CardContent, CardHeader} from '@/components/ui/card'

const Page = () => {
  const t = useTranslations('Auth.VerifyRequestPage')

  return (
    <div className="lg:p-8">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <Card>
          <CardHeader className="text-xl font-semibold">
            {t('title')}
          </CardHeader>
          <CardContent>{t('description')}</CardContent>
        </Card>
      </div>
    </div>
  )
}

export default Page
