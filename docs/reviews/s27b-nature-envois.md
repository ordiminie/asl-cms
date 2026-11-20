# Review — Story s27b-nature-envois

> Round 1, 20/11/2026. Subagent `reviewer` en contexte neuf, diff `git diff main...feature/s27b-nature-envois`
> (commit `348698b9`, 51 fichiers, migration 0071 comprise). Tests lancés dans un worktree détaché du même
> commit, sur disque local.

## Synthèse

Aucun constat critique ni majeur, trois mineurs. Chacun des six critères est couvert par un test qui
échouerait si le comportement disparaissait.

| Vérification                             | Résultat                                                        |
| ---------------------------------------- | --------------------------------------------------------------- |
| `pnpm test --run`                        | 417 fichiers, **5614 réussis**, 1 ignoré, code 0, aucun timeout |
| `tsc --noEmit -p .`                      | 0 erreur                                                        |
| `eslint` sur les 45 `.ts`/`.tsx` du diff | 0 erreur                                                        |
| `pnpm db:generate` sur la branche        | « No schema changes, nothing to migrate »                       |
| e2e, build                               | non lancés en local ; e2e en CI                                 |

## Migration

- **Snapshots** : 0070 → 0071 ne diffèrent que par l'enum `public.campaign_nature` et la colonne
  `campaign.nature` (`notNull`, défaut `'facultative'`). `id` et `prevId` sont bien chaînés.
- **SQL et journal** : le SQL est celui que drizzle génère ; le journal gagne une seule entrée (idx 71).
- **Campagnes existantes** : elles valent `facultative` (ADR 064 §3).
- **RLS** : aucune policy touchée, celle de `campaign` est inchangée.

## Anti-hallucination — les références existent

- **Écriture refusée au bureau côté serveur.** `isSuperAdminOnlySetting` et
  `canEditSuperAdminOnlySettingsService` existent. `touchesSuperAdminOnlySetting`
  (`association-settings-service.ts:94-101`) parcourt le registre : le bureau reçoit une
  `AuthorizationError` et rien n'est écrit. La clé n'est donc pas seulement masquée à l'écran.
- **La livraison lit la nature figée.** `getCampaignByIdDao` fait un `select()` complet : `nature` est lue
  sur la campagne. C'est pourquoi `campaign-repository.ts` et `unsubscribe-dal.ts`, prévus au plan,
  n'avaient rien à changer.
- **La page publique lit les réglages sans session.** `getAssociationSettingsService` ne demande pas
  d'authentification et lit sous `withTenant`.
- **Les libellés atteignent la page publique.** `NextIntlClientProvider` transmet tous les messages
  (`base-layout.tsx:81`), y compris `AssociationSettings.campaignNature`, que le composant client lit.
- **Pas de régression sur les groupes.** `recipient-group-service.ts:111-114` garde la nature par défaut
  (`facultative`), donc le comportement d'avant.

## Points vérifiés

- **Défaut sûr.** `getCampaignNature` ne rend `statutaire` que sur une égalité stricte. Absente, vide,
  inconnue ou mal casée, la valeur vaut `facultative` ; chaque cas est testé. Aucune classification dans
  le code : seul le seed TechCorp en porte une.
- **Aucune nature saisie par le bureau.**
  - Le composeur l'affiche en texte, sans contrôle pour la changer.
  - Les actions ne lisent pas de nature.
  - Le schéma de l'envoi retire les clés inconnues ; un test vérifie qu'une nature ajoutée à la saisie est
    ignorée.
- **Nature figée à la création.**
  - `sendCampaignService` l'écrit sur la campagne ; `deliverToRecipient` ne lit qu'elle et ne saute le
    contrôle de désinscription qu'en `statutaire`.
  - Le pied de page suit la nature figée à la livraison, et la nature courante du modèle dans l'aperçu.
  - Deux tests vérifient qu'un reclassement n'agit pas sur une campagne en cours, dans les deux sens.
- **Page de désinscription.**
  - Le tenant est résolu par le domaine.
  - L'état ne contient que des identifiants de modèles ; un test vérifie qu'aucune donnée du membre ne
    s'y trouve.
  - Un jeton invalide ne déclenche pas la lecture de la classification, et un échec de lecture ne promet
    rien.
- **Pied de page conforme à l'écran 4 du design.**
  - En statutaire, la phrase vient au-dessus du bouton, libellé « Ne plus recevoir les campagnes
    facultatives ».
  - La phrase « Se désinscrire ne vous prive d'aucune information obligatoire » reste sur les deux
    natures, comme l'URL en clair et `List-Unsubscribe`.
  - La version texte suit le même ordre ; c'est testé.

## Écarts déclarés par l'implémenteur

| Écart                                                | Jugement                                                                                                                         |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `templateNatures` dans le DTO du composeur           | Justifié : le composeur affiche la nature de chaque modèle.                                                                      |
| `readOnlyHelpKey` et `whenEmptyKey` pour un `choice` | Sans effet ailleurs : aucun autre `choice` n'a de `whenEmptyKey`, et sans `readOnlyHelpKey` l'aide retombe sur `superAdminOnly`. |
| Signatures qui exigent le modèle                     | Tous les appelants sont à jour ; le typecheck est vert.                                                                          |
| Libellés repris de `AssociationSettings`             | Acceptable : les mêmes noms d'envoi dans les deux écrans.                                                                        |
| Espaces ordinaires avant « : »                       | Conformes aux clés voisines.                                                                                                     |
| Tests existants modifiés                             | Seulement les nouveaux arguments et champs ; aucune assertion affaiblie.                                                         |
| Migration dans le commit de story                    | Conforme à AGENTS.md.                                                                                                            |

## Couverture critère par critère

1. **Nature lue dans la configuration** : registre, DTO et ligne affichée testés ; e2e. ✅
2. **Défaut `facultative`** : accesseur (absente, vide, inconnue, casse), service et seed. ✅
3. **Trois cibles × deux natures** : règle (`it.each`, adresse partagée, fiche sans adresse), service
   (`describe.each` : décompte, destinataires, nature figée, `unsubscribedCount`) et e2e. ✅
4. **Pied statutaire** : rendus HTML et texte, livraison (nature figée), aperçu (nature courante), e2e. ✅
5. **Écran de désinscription** : service, panneau dans tous ses états, page et e2e. ✅
6. **Reclassement au prochain envoi** : service (deux envois), livraison, e2e (reclassement par le
   SuperAdmin). ✅

## Constats

### Critical

Aucun.

### Major

Aucun.

### Minor

- **m1** — `src/services/__tests__/association-settings-service.test.ts:223-276`.
  - Constat : le refus au bureau n'est testé que pour la limite d'envoi et la réserve. Pour les clés de
    nature, la protection est réelle mais prouvée indirectement (mécanisme générique et liste exacte du
    registre).
  - Scénario d'échec : si une liste de clés en dur remplaçait un jour `touchesSuperAdminOnlySetting`,
    aucun test de service ne verrait que le bureau peut reclasser « Message libre ».
  - Correction : un cas `campaign.nature.free: 'statutaire'`.
- **m2** — `src/services/association-settings-service.ts:98-100`.
  - Constat : le message interne de l'`AuthorizationError` ne cite que la limite et la réserve. Il est
    périmé depuis s19 et l'est davantage avec s27b.
  - Portée : visible dans les journaux seulement.
- **m3** — `src/services/unsubscribe-service.ts:79-81`.
  - Constat : un échec de lecture des réglages fait passer la page en état `error`, même avec un jeton
    valide.
  - Correction possible : ne dégrader que `statutoryTemplateIds` à `null`, cas que le panneau gère déjà.

### Remarques sans gravité

- **Mise en production.** La classification de La Fourche n'existe qu'en seed de test. Tant que le
  SuperAdmin ne l'a pas saisie dans les réglages, tout vaut `facultative` (sens sûr ; ADR 064). À ajouter
  aux points de mise en prod.
- **« Message libre » reclassable.** Le SuperAdmin peut le passer en statutaire : c'est cohérent avec
  l'arbitrage du 20/11 et l'ADR 064.
- **Lecture seule du bureau.** Le réglage s'affiche en `radio-group` désactivé, forme déjà utilisée pour
  `billing.provider`, et non en champ grisé comme dans la maquette 1b.

Max severity: minor
Ship allowed: yes
