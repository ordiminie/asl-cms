'use client'

import {Menu} from 'lucide-react'
import {useTranslations} from 'next-intl'

import {Button} from '@/components/ui/button'
import {useSidebar} from '@/components/ui/sidebar'

/** Ouvre le tiroir de l'espace bureau sur petit ecran (design s01b, mobile). */
export function BureauMenuButton() {
  const t = useTranslations('BureauIdentityPage.nav')
  const {toggleSidebar} = useSidebar()

  return (
    <Button
      type="button"
      variant="outline"
      aria-label={t('openMenu')}
      className="h-11 shrink-0 px-3"
      onClick={toggleSidebar}
    >
      <Menu aria-hidden="true" className="size-5" strokeWidth={1.75} />
      <span>{t('menu')}</span>
    </Button>
  )
}
