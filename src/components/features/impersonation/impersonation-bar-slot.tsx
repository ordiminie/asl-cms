import {cookies} from 'next/headers'
import {getTranslations} from 'next-intl/server'

import {stopImpersonationAction} from '@/app/[locale]/admin/organizations/actions'
import {getImpersonationBarDal} from '@/app/dal/impersonation-dal'

import {ImpersonationBar} from './impersonation-bar'

/**
 * Le cookie signe que pose le plugin admin() a l'ouverture d'une session a la
 * place d'un compte : `<prefixe>.admin_session`, `__Secure-` en HTTPS.
 */
const ADMIN_SESSION_COOKIE_SUFFIX = '.admin_session'

/**
 * L'emplacement serveur de la banniere (s48), a placer derriere
 * `<Suspense fallback={null}>`. Sans le cookie de session d'origine, aucune
 * session n'est lue : une page publique ne paie rien hors imitation.
 */
export async function ImpersonationBarSlot() {
  const jar = await cookies()
  const impersonating = jar
    .getAll()
    .some(({name}) => name.endsWith(ADMIN_SESSION_COOKIE_SUFFIX))
  if (!impersonating) return null

  const bar = await getImpersonationBarDal()
  if (!bar) return null

  const t = await getTranslations('Impersonation')
  return (
    <ImpersonationBar
      subjectName={bar.subjectName}
      roleLabel={t(`roles.${bar.role}`)}
      organizationName={bar.organizationName}
      expiresAt={bar.expiresAt}
      stopAction={stopImpersonationAction}
    />
  )
}
