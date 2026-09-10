import {requireEnabledModuleDal} from '@/app/dal/tenant-dal'

/**
 * Sonde d'activation de module — la preuve du critere 4 de s01.
 *
 * Elle existe parce qu'aucun module n'a encore d'ecran : `vote` arrive en s33,
 * `voirie` en s34, `annonces` en s35. Sans elle, « une route de module inactif
 * ou de cle inconnue est introuvable » ne serait verifiable nulle part.
 *
 * Volontairement **sans interface** : une ligne de texte, aucun composant du
 * socle, aucun token — le design system range l'ecran d'un module sans page
 * parmi ses manques (design de s01, manque n° 4), et inventer cet ecran ici
 * serait un echec de revue. Les stories s33 a s35 remplacent cette route par
 * les vrais ecrans, en gardant l'appel au helper en tete de page.
 */
export default async function ModuleProbePage({
  params,
}: {
  params: Promise<{module: string}>
}) {
  const {module} = await params

  // En tete de page, avant tout rendu : module inactif ou cle inconnue rend la
  // page introuvable (ADR 010, ADR 013).
  const tenant = await requireEnabledModuleDal(module)

  return (
    <p data-testid="module-actif">
      {module} · {tenant.name}
    </p>
  )
}
