'use client'

import {Globe} from 'lucide-react'
import {useParams} from 'next/navigation'
import {useTranslations} from 'next-intl'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {usePathname, useRouter} from '@/i18n/navigation'
import {routing} from '@/i18n/routing'

export function LangToggle() {
  const t = useTranslations('LangToggle')
  const params = useParams()
  const router = useRouter()
  const pathname = usePathname()

  const currentLocale = params.locale as string

  const handleLanguageChange = (newLocale: string) => {
    // Strip locale prefix if present (next-intl bug with static pages)
    const cleanPathname = pathname.startsWith(`/${currentLocale}`)
      ? pathname.slice(currentLocale.length + 1) || '/'
      : pathname
    router.replace(cleanPathname, {locale: newLocale})
  }

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4" />
      <Select value={currentLocale} onValueChange={handleLanguageChange}>
        <SelectTrigger className="w-[120px]" aria-label={t('label')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {routing.locales.map((locale) => (
            <SelectItem key={locale} value={locale}>
              {t(`languages.${locale}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
