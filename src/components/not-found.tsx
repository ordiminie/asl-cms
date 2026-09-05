import {Search} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'

import {Button} from './ui/button'
import {Card, CardContent, CardFooter, CardHeader, CardTitle} from './ui/card'
export default function NotFoundComponent() {
  const t = useTranslations('NotFoundPage')
  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-6xl font-bold">404</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-2xl font-semibold">{t('title')}</p>
          <p className="text-muted-foreground">{t('description')}</p>
          <div className="flex justify-center" aria-hidden="true">
            <Search className="text-muted-foreground h-12 w-12" />
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button asChild>
            <Link href="/">{t('goBackHome')}</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
