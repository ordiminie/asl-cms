# Revue du découpage en stories — ASL-CMS (Lp)

> Revue en contexte neuf de `docs/stories.md` face à `docs/prd.md`, par le subagent
> `stories-reviewer` (skill `stories-review` préchargée). Chaque constat est classé
> critical / major / minor.
>
> **Cinquième passage** — 39 stories, PRD amendé (ligne « Limitation de débit des formulaires
> publics »). Reviewer neuf, sans connaissance des passages précédents. **Le critical du 4e passage
> est levé** : la dépendance circulaire s03 ↔ s12 a disparu avec l'extraction de s14. Deux majors
> subsistent, tous deux corrigeables en quelques lignes.
>
> Document de cadrage : committé sur la branche par défaut, contrairement à
> `docs/reviews/<id>.md` qui voyage avec sa branche de story.

## Couverture du périmètre

Parcours ligne à ligne du tableau du PRD (et non des stories).

**Tronc commun**

| Feature du PRD (core loop) | Couverte par | OK ? |
| --- | --- | --- |
| CMS de pages génériques (créer / modifier / publier / dépublier) | s04 | ✅ |
| Permissions par rôle configurables en back-office | s36 | ✅ |
| Connexion par lien magique (validité 4 h) | s03 (flux d'invitation : s14, s39) | ✅ |
| Pages publiques + formulaire de contact archivé en BO | s04 + s08 | ✅ |
| Limitation de débit des formulaires publics | s08 seul — s10 non protégée | ⚠️ partiel |
| Bandeau d'alerte global | s07 | ✅ |
| SEO (sitemap, métadonnées, Search Console) | s11 | ✅ |
| Import initial des membres | s13 | ✅ |
| Modèle membre ↔ parcelle daté | s12 | ✅ |
| Coordonnées (profil membre) | s15 | ✅ |
| Questions au bureau, catégories avec routage email | s22 (modèle de catégories : s10) | ✅ |
| Notes internes et historique par membre | s23 | ✅ |
| Import annuel des relevés d'eau + rapport d'erreurs par email | s16 | ✅ |
| Historique de consommation d'eau par membre | s17 | ✅ |
| Signalements avec catégories et statuts (public + membre) | s10 + s21 | ✅ |
| Publication des analyses d'eau | s09 | ✅ |
| Documents partagés | s30 | ✅ |
| Documents nominatifs en dossiers physiquement séparés | s31 | ✅ |
| Campagnes email Brevo (4 modèles + libre, gabarit commun) | s24 | ✅ |
| Envoi échelonné au-delà de 300 destinataires | s25 | ✅ |
| Relances d'impayés (3, à 3/2/1 semaines), activables par tenant | s28 | ✅ |
| Publipostage PDF pour les membres sans email | s27 | ✅ |
| Groupes de destinataires personnalisés | s26 | ✅ |
| Statistiques d'ouverture et de clic des campagnes | s29 | ✅ |
| Modèles de documents réutilisables | s35 | ✅ |
| Facturation membres : interface + implémentation Pennylane | s18 (interface + manuel) + s19 (Pennylane) | ✅ |
| Redirection de paiement | s20 | ✅ |
| Multi-tenant (Organization, config par tenant, RLS Postgres) | s01 + s02 | ✅ |
| Export et portabilité des données | s37 | ✅ |

**Modules activables par tenant**

| Feature du PRD | Couverte par | OK ? |
| --- | --- | --- |
| Vote : interface + implémentation ASL Community | s32 | ✅ |
| Voirie | s33 | ✅ |
| Petites annonces entre membres | s34 | ✅ |

- [x] Chaque feature du tableau « Replicated (core loop) » est livrée par au moins une story —
  **aucune feature orpheline.** Une ligne (limitation de débit) n'est appliquée qu'à moitié ; voir
  Constats.

Cinq stories sont hors tableau (s05 actualités, s06 présentation du bureau, s14 invitation unitaire,
s38 simulation de rôle, s39 lancement). Chacune nomme explicitement son ancrage dans le PRD (critères
de succès, « Why kill it » n°2, ligne « lien magique », Target users). Acceptées comme dérivations,
pas comme dérive.

## Périmètre

- [x] Aucune story ne réintroduit un élément du cimetière. Les 16 entrées ont été vérifiées :
  électricité / gaz, logique de vote (s32 la refuse dans ses notes et ses critères), traitement des
  paiements (le critère 3 de s20 teste l'*absence* de champs de paiement), messagerie privée (s34 la
  refuse), multi-immeubles / tantièmes, plan B de connexion (s12, s27 et s39 répètent tous le refus),
  appels de fonds, carte interactive (s33 = image statique), vote en direct / procurations, IA
  conversationnelle, classification IA (s31), Kanban, messagerie dédiée, base par tenant (s01 = RLS
  partagée), abstraction « ressource partagée » (s33), WordPress (s04). **Le cimetière n'est pas
  seulement respecté, il est activement cité aux endroits où un agent dériverait. C'est le point le
  plus solide du découpage.**
- [~] Aucune story ne dépasse le périmètre — une frange (le suivi d'adoption de s39), minor.

## Qualité des stories

- [x] Chaque story est une tranche livrable de bout en bout, pas une couche technique. Pas de
  « monter la base », pas de « créer la couche API ». Les deux stories qui auraient pu être des
  couches techniques — s01 (multi-tenant) et s18 (interface de facturation) — sont toutes deux
  cadrées sur un acteur réel avec un résultat observable, et s19 est délibérément une implémentation
  *derrière* une s18 déjà livrée, pas une couche qui la précède.
- [~] Chaque critère d'acceptation peut devenir un test — trois exceptions, toutes mineures
  (s02 c4, s37 c2, s14 c2).
- [x] Notes agentiques présentes et utiles sur les 39 stories : fichiers du boilerplate à réemployer,
  pièges de cache, Supabase → stockage local, Resend → Brevo, RLS et pool, Inngest sur le VPS.
  Au-dessus du standard habituel.
- [x] Complexité renseignée ; aucun 5 ; les six 4 (s01, s12, s28, s31, s36, s37) énoncent chacun leur
  risque dans les notes.

## La liste dans son ensemble

- [x] Ordre de dépendances exécutable : aucun cycle. Toute dépendance déclarée pointe vers un id
  strictement inférieur ; les 20 dépendances de s37 et les 6 de s39 se résolvent toutes vers l'amont.
  **Les deux circularités que le document dit avoir corrigées (s03 ↔ s12 via s14) ont effectivement
  disparu.**
- [x] Ids bien formés `s<numéro>-<slug>`, uniques de s01 à s39, aucun doublon, aucun trou.
- [~] Aucun recouvrement — s10 / s22 / s34 partagent le modèle de catégories par conception et le
  disent, mais les critères sont presque dupliqués (minor).

## Constats

### Majors

- **major — s10** — la ligne du PRD « Limitation de débit des formulaires publics » est au pluriel ;
  seule s08 porte les deux critères de limitation. Le formulaire de signalement public **anonyme** de
  s10 (catégories, texte libre, notification email au bureau) n'a aucun critère de limitation et ne
  dépend pas de s08. Livré tel quel, le produit expose un second formulaire public non protégé —
  exactement le vecteur de spam que la ligne du PRD a été ajoutée pour fermer, et celui qui coûte au
  bureau bénévole le temps que le produit prétend lui rendre. **Correction** : ajouter le critère à
  s10 et `s08` à ses dépendances.
- **major — s14** — le critère 2 exige que l'email d'invitation porte « le gabarit de l'association
  (logo, mentions) ». Ce gabarit appartient à **s24** (critère 3) et il est alimenté par les
  paramètres de tenant de **s02**. s14 ne déclare ni l'un ni l'autre (`s03, s12`). Référence en
  avant : un agent exécutant s14 devrait inventer un en-tête et un pied de page, et s24 construirait
  ensuite le vrai — la seconde implémentation que le document interdit partout ailleurs (s12, s14,
  s21 et s35 portent toutes un « une seconde implémentation serait un défaut de review » explicite).
  Le même critère promet aussi « ses factures, sa consommation d'eau, ses documents », livrés par
  s17, s18, s30 et s31, tous postérieurs.

### Minors

- **minor — s22** — le bloc Dependencies indique `s02, s12`, alors que les notes agentiques
  précisent que le modèle de catégories est livré par s10 et seulement réutilisé ici. s10 précède
  s22, donc l'ordre tient, mais la dépendance déclarée est fausse — et c'est ce bloc que lit
  `/ks-research`. Même omission dans **s34** (déclare `s12, s22`, jamais s10).
- **minor — s37** — l'inventaire et la liste de dépendances se contredisent : « campagnes et leurs
  **statistiques** » est énuméré mais s29 n'est pas en dépendance ; l'historique des relances
  persisté par s28 (critère 6 : « nombre et dates des relances déjà envoyées ») et l'état de
  planification de s25 n'apparaissent ni dans l'énumération ni dans les dépendances. Le test de
  complétude sur les tables scopées par `organization_id` l'atténue par construction — c'est ce qui
  le maintient en minor plutôt qu'en major.
- **minor — récapitulatif (ligne 1865)** — « Un seul écart avec les scores du PRD : s26 à 3 contre
  2 » est faux. s37 est chiffrée 4 contre 3 au PRD, et ses propres notes le reconnaissent (« relevée
  de 3 en revue du découpage »). Deux divergences, toutes deux légitimes ; une seule est déclarée.
- **minor — s01** — malgré l'extraction de s38, la story groupe encore trois valeurs séparables :
  création du tenant, **routage par domaine**, et drapeaux d'activation des modules. Les notes
  justifient de garder le routage ici (c'est lui qui rend testable « deux associations, deux sites »),
  ce que j'accepte — mais c'est la seule story dont la tranche est visiblement plus large que les
  autres.
- **minor — s39** — le suivi d'adoption (décomptes, liste des jamais connectés, réinvitation ciblée)
  va un cran au-delà de la ligne « flux d'invitation » du PRD. Petit et bien argumenté via s14, mais
  c'est du périmètre ajouté.
- **minor — s26 c7 / règle transverse** — la doctrine de désinscription (facultatif vs statutaire)
  est codée en critère de test ferme alors que le document lui-même la signale « ⚠️ à faire confirmer
  par le conseil RGPD ». L'incertitude comparable de s12 (rétention / purge) est explicitement *non*
  codée en attendant l'arbitrage. Traitement incohérent de deux arbitrages RGPD en attente.
- **minor — s02 c4** — « Les valeurs de départ de La Fourche (`contact@asl-exemple.test`,
  responsable forage) se lisent depuis le tenant » : la première valeur est assertable, « responsable
  forage » n'a ni clé ni valeur et ne peut pas devenir une assertion en l'état.
- **minor — s37 c2** — « Les CSV s'ouvrent sans erreur dans un tableur » est une vérification
  humaine ; seule la parenthèse (UTF-8, séparateur documenté) est testable. Reformuler autour de la
  parenthèse.

## Ce qui est juste et mérite d'être dit

Couverture intégrale du périmètre, cimetière activement défendu, zéro cycle, aucun 5 non scindé,
chaque 4 portant son risque, dépendances externes bloquantes cartographiées vers les stories exactes
qu'elles bloquent avec leurs contournements documentés (s18 avant s19, s28 explicitement pas otage de
Pennylane), et le test de complétude de s37 conçu pour **échouer** plutôt que de reposer sur une
liste écrite à la main. Les trois correctifs des revues précédentes (s14, s38, s39) sont de vrais
correctifs, pas des retouches cosmétiques.

## Verdict

Les deux majors sont des éditions d'une ligne dans `docs/stories.md` (ajouter un critère et une
dépendance à s10 ; déplacer la propriété du gabarit ou l'ordonnancement pour s14). Les corriger ici
coûte une édition markdown ; les livrer coûte un formulaire public non protégé et un gabarit d'email
dupliqué, propagé à travers la recherche, la conception, le plan, le code et la review. C'est
exactement l'arbitrage que cette étape existe pour rendre — d'où le `no`.

Max severity: major
Stories ready: no
