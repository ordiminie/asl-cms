import Link from 'next/link'
import {useTranslations} from 'next-intl'

import ImageTheme from '@/components/image-theme'
import {PagesConst} from '@/env'
import {APP_NAME} from '@/lib/constants'
import {isPageEnabled} from '@/lib/utils'

export default function PublicFooter() {
  const t = useTranslations('HomePage')

  return (
    <footer className="border-border bg-background/80 mt-auto w-full border-t px-4 py-12 sm:px-6 md:px-8">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 text-left sm:grid-cols-2 md:grid-cols-4">
        <div>
          <div className="mb-4 flex items-center gap-2">
            <ImageTheme
              className="relative z-10"
              src="/next.svg"
              srcDark="/next-inverted.svg"
              alt="App Logo"
              width={28}
              height={28}
              priority
            />
            <span className="text-lg font-bold">{APP_NAME}</span>
          </div>
          <p className="text-muted-foreground mb-2 text-sm">
            {t('footer.byMike')}
          </p>
          <p className="text-muted-foreground text-xs">
            © {new Date().getFullYear()} {APP_NAME}.{' '}
            {t('footer.allRightsReserved')}
          </p>
        </div>
        <div>
          <h4 className="mb-4 font-semibold">{t('footer.product.title')}</h4>
          <ul className="space-y-3 text-sm">
            <li>
              <Link href="#features" className="hover:text-primary transition">
                {t('footer.product.features')}
              </Link>
            </li>
            <li>
              <Link href="/pricing" className="hover:text-primary transition">
                {t('footer.product.pricing')}
              </Link>
            </li>
            <li>
              <Link href="#" className="hover:text-primary transition">
                {t('footer.product.demo')}
              </Link>
            </li>
            <li>
              <Link href="#" className="hover:text-primary transition">
                {t('footer.product.updates')}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="mb-4 font-semibold">{t('footer.resources.title')}</h4>
          <ul className="space-y-3 text-sm">
            {isPageEnabled(PagesConst.DOCS) && (
              <li>
                <Link href="/docs" className="hover:text-primary transition">
                  {t('footer.resources.documentation')}
                </Link>
              </li>
            )}
            {isPageEnabled(PagesConst.BLOG) && (
              <li>
                <Link href="/blog" className="hover:text-primary transition">
                  {t('footer.resources.blog')}
                </Link>
              </li>
            )}
            <li>
              <Link href="/docs" className="hover:text-primary transition">
                {t('footer.resources.support')}
              </Link>
            </li>
            <li>
              <Link href="#" className="hover:text-primary transition">
                {t('footer.resources.api')}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="mb-4 font-semibold">{t('footer.legal.title')}</h4>
          <ul className="space-y-3 text-sm">
            <li>
              <Link href="/terms" className="hover:text-primary transition">
                {t('footer.legal.terms')}
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-primary transition">
                {t('footer.legal.privacy')}
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-primary transition">
                {t('footer.legal.contact')}
              </Link>
            </li>
            <li>
              <Link href="#" className="hover:text-primary transition">
                {t('footer.legal.careers')}
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  )
}
