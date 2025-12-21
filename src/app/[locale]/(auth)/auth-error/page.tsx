'use client'

import {Ban, GalleryVerticalEnd, ShieldAlert} from 'lucide-react'
import Link from 'next/link'
import {useSearchParams} from 'next/navigation'
import {useTranslations} from 'next-intl'

import {Button} from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {APP_NAME} from '@/lib/constants'

const ERROR_ICONS: Record<string, React.ReactNode> = {
  banned: <Ban className="text-destructive h-12 w-12" />,
  default: <ShieldAlert className="text-destructive h-12 w-12" />,
}

export default function AuthErrorPage() {
  const searchParams = useSearchParams()
  const t = useTranslations('AuthErrorPage')

  const error = searchParams.get('error') || 'unknown'
  const message = searchParams.get('message')

  const decodedMessage = message ? decodeURIComponent(message) : null
  const icon = ERROR_ICONS[error] || ERROR_ICONS.default

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link
          href="/"
          className="flex items-center gap-2 self-center font-medium"
        >
          <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
            <GalleryVerticalEnd className="size-4" />
          </div>
          {APP_NAME}
        </Link>
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-2xl font-bold">
              {t('title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <div className="flex justify-center" aria-hidden="true">
              {icon}
            </div>
            {decodedMessage ? (
              <p className="text-muted-foreground">{decodedMessage}</p>
            ) : (
              <p className="text-muted-foreground">{t(`errors.${error}`)}</p>
            )}
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button asChild>
              <Link href="/login">{t('backToLogin')}</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
