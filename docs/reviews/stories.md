# Revue du découpage en stories — ASL-CMS (Lp)

> Revue en contexte neuf de `docs/stories.md` face à `docs/prd.md`, par le subagent
> `stories-reviewer` (skill `stories-review` préchargée). Chaque constat est classé
> critical / major / minor.
>
> **Deuxième passage** — 37 stories, PRD amendé (ligne « Import initial des membres » ajoutée au
> périmètre). Reviewer neuf, sans connaissance du premier passage : les trois majors précédents
> (dépendance s35 → s31, cible « impayés » sans propriétaire, marquage « sans email » porté par s13)
> ne sont plus signalés et la couverture ressort complète.
>
> Document de cadrage : committé sur la branche par défaut, contrairement à
> `docs/reviews/<id>.md` qui voyage avec sa branche de story.

## Couverture du périmètre

Parcours ligne à ligne du tableau du PRD (lignes 62-97), et non des stories.

**Tronc commun — livré à toute association**

| Feature du PRD (core loop) | Couverte par | OK ? |
| --- | --- | --- |
| CMS de pages génériques (créer / modifier / publier / dépublier) | s04 | ✅ |
| Permissions par rôle configurables en back-office | s35 | ✅ |
| Connexion par lien magique (validité 4 h) | s03 | ✅ |
| Pages publiques + formulaire de contact archivé en BO | s04, s08 | ✅ |
| Bandeau d'alerte global | s07 | ✅ |
| SEO (sitemap, métadonnées, Search Console) | s11 | ✅ |
| Import initial des membres d'une association | s13 | ✅ |
| Modèle membre ↔ parcelle **daté** | s12 | ✅ |
| Coordonnées (profil membre) | s14 | ✅ |
| Questions au bureau, catégories avec routage email | s21 | ✅ |
| Notes internes et historique par membre | s22 | ✅ |
| Import annuel des relevés d'eau + rapport d'erreurs par email | s15 | ✅ |
| Historique de consommation d'eau par membre | s16 | ✅ |
| Signalements avec catégories et statuts (public + membre) | s10, s20 | ✅ |
| Publication des analyses d'eau | s09 | ✅ |
| Documents partagés (statuts, PV, ordres du jour) | s29 | ✅ |
| Documents nominatifs en dossiers physiquement séparés | s30 | ✅ |
| Campagnes email Brevo (4 modèles + campagne libre, gabarit commun) | s23 | ✅ |
| Envoi échelonné au-delà de 300 destinataires | s24 | ✅ |
| Relances d'impayés (3, à 3/2/1 semaines), activables par tenant | s27 | ✅ |
| Publipostage PDF pour les membres sans email | s26 | ✅ |
| Groupes de destinataires personnalisés | s25 | ✅ |
| Statistiques d'ouverture et de clic des campagnes | s28 | ✅ |
| Modèles de documents réutilisables | s34 | ✅ |
| Facturation membres : interface + implémentation Pennylane | s17 (interface + manuel), s18 (Pennylane) | ✅ |
| Redirection de paiement | s19 | ✅ |
| Multi-tenant (Organization, config par tenant, RLS Postgres) | s01, s02 | ✅ |
| Export et portabilité des données | s36 | ✅ |

**Modules activables par tenant**

| Feature du PRD | Couverte par | OK ? |
| --- | --- | --- |
| Vote : interface + implémentation ASL Community | s31 | ✅ |
| Voirie | s32 | ✅ |
| Petites annonces entre membres | s33 | ✅ |

- [x] Chaque feature du tableau « Replicated (core loop) » est livrée par au moins une story —
  **30/30, aucun trou.** C'est la vérification qui échoue le plus souvent ; elle passe proprement ici.

## Périmètre

- [x] Aucune story ne réintroduit un élément du cimetière du PRD. Vérifié élément par élément, y
  compris les deux pièges : s12 crée une fiche membre **sans** compte de connexion (donc aucun « plan
  B de connexion »), et s18 comme s19 portent un test explicite affirmant l'absence de champ de moyen
  de paiement dans le schéma. s31 exclut dépouillement / quorum / procurations, s32 la carte
  interactive, s30 la classification IA, s33 la messagerie privée, s01 la base par tenant.
- [~] Aucune story ne dépasse le périmètre — trois stories livrent une valeur qui **n'est pas une
  ligne du tableau du périmètre** (s05 actualités, s06 présentation-bureau, s37 simulation-role).
  Toutes trois sont fondées ailleurs dans le PRD (critères de succès ligne 167, « Why kill it » §2
  ligne 29, Target users ligne 52), mais aucune n'y est chiffrée. Minor.

## Qualité des stories

- [x] Chaque story est une tranche livrable de bout en bout, pas une couche technique. Pas de
  « monter la base », pas de « créer la couche API ». Les deux candidates à la story de couche —
  s01 (multi-tenant) et s17 (interface de facturation) — sont chacune formulées avec un utilisateur
  réel et des résultats testables, et le multi-tenant est lui-même une ligne du périmètre.
- [~] Chaque critère d'acceptation peut devenir un test — la plupart le peuvent ; quelques-uns
  affirment une structure de code ou emploient une formulation non mesurable (voir Constats).
- [x] Notes agentiques présentes et utiles dans les 37 stories : chemins de fichiers réels
  (`src/db/models/organization-model.ts`, `src/app/sitemap.ts`, `edit-user-profile.tsx`), pièges du
  boilerplate (Resend→Brevo, Supabase→stockage local, `'use cache'` / logger), et rappels explicites
  du cimetière.
- [~] Complexité renseignée partout ; **aucun 5** ; les cinq 4 (s01, s12, s27, s30, s35) explicitent
  leur risque. Deux scores paraissent sous-évalués au regard du contenu de la story (s13, s23).

## La liste dans son ensemble

- [x] Ordre de dépendances exécutable : toute dépendance déclarée pointe vers un id strictement
  inférieur, donc l'ordre numérique est un ordre topologique valide. Aucun cycle, aucune référence en
  avant au niveau des stories.
- [x] Ids bien formés (`s01`..`s37`, `s<numéro>-<slug>`), uniques, zéro-paddés de façon cohérente,
  slugs courts et stables.
- [x] Aucun recouvrement entre stories. Les paires adjacentes sont explicitement désambiguïsées dans
  les notes : s04/s05/s06, s08/s21, s10/s20, s17/s18, s23/s25, s26/s34, s35/s37.

## Constats

### Major

- **major — s01** — le critère « Les modules `vote`, `voirie` et `annonces` s'activent et se
  désactivent par association ; désactivé, le module n'apparaît ni en navigation ni en accès direct
  par URL (404, pas un lien masqué) » **ne peut pas devenir un test qui passe au moment où s01 est
  livrée** : les trois modules arrivent en s31, s32 et s33, trente stories plus loin. C'est une
  référence en avant à l'intérieur d'un critère d'acceptation, et elle fait doublon avec un critère
  que chacune de ces trois stories porte déjà (« Le module se désactive par tenant »).
  Reformuler s01 sur ce qui est vérifiable à sa livraison (le drapeau existe, il est persisté par
  tenant, une clé de module inconnue ou inactive résout en 404) et laisser la preuve par module à
  s31 / s32 / s33.

### Minors

- **minor — s13** — complexité 2 pour une story qui porte un écran de téléversement en back-office,
  une validation ligne à ligne, un rapport d'erreurs, l'idempotence, la création de comptes pour 300
  fiches sur 400, **et une clé de dédoublonnage explicitement non tranchée** dont les notes décrivent
  elles-mêmes le mode de défaillance : « fusionner deux propriétaires distincts leur donnerait accès
  aux documents l'un de l'autre ». C'est un 3 avec risque énoncé, pas un 2. Le PRD la chiffre 2 aussi
  — l'écart est entre le score et le contenu, dans les deux documents.
- **minor — s23** — complexité 3 pour 9 critères groupant : composition, 4 modèles + mode libre,
  gabarit commun en-tête/pied, moteur de variables, aperçu, archivage, **et** le calcul de la cible
  « impayés » à partir de l'interface s17. Ce calcul est la pièce qui pourrait porter sa propre
  tranche. Soit le scinder, soit repasser la story à 4 avec le risque énoncé.
- **minor — s02** — deux critères affirment une structure de code plutôt qu'un comportement
  observable : « jamais sur une constante dispersée dans le code » et « pas comme littéraux dans le
  code applicatif ». Ce sont des affirmations de revue, pas des tests. Garder la moitié
  comportementale (valeur par défaut appliquée quand la ligne est absente ; données de seed présentes
  pour le tenant) et déplacer la moitié structurelle dans les notes agentiques.
- **minor — s02** — « l'ancienne valeur n'est plus utilisée au prochain envoi » renvoie à un envoi
  d'email, qui n'existe pas avant s03. Reformuler sur une lecture observable du paramètre, dans le
  périmètre propre de s02.
- **minor — s26 / s36 / s27 / s10** — critères qui demandent une définition mesurable avant de
  pouvoir devenir des tests : s26 « directement imprimable […] bloc adresse positionné pour une
  enveloppe à fenêtre » (aucun format nommé — DL 110×220 mm ?), s36 « format ouvert et relisible »
  (aucun format nommé — CSV ? JSON ? les deux ?), s27 « orientés vers le publipostage » (aucun
  comportement observable), s10 « aucune identité n'est déduite » (infalsifiable tel quel).
- **minor — s24** — la règle de scission n'est définie que comme « deux envois » (le jour même puis
  le lendemain). Avec un seuil de tenant à 300 et un tenant dépassant 600 destinataires, le
  comportement spécifié dépasse encore le quota. Le PRD dit « scission sur deux jours », donc on
  reste dans le périmètre, mais la story devrait fixer ce qui se passe au-delà de 2× le seuil plutôt
  que de le laisser à l'implémenteur.
- **minor — s36** — les dépendances déclarées (s22, s30) ne couvrent pas ce que l'export doit
  contenir : campagnes (s23), signalements (s10), relevés (s15), factures (s17), contenus publiés
  (s04/s05/s09). L'ordre numérique sauve l'exécution, mais la déclaration est incomplète et la story
  serait planifiée sur une image partielle.
- **minor — s26** — déclare une dépendance sur s13 qu'aucun critère d'acceptation n'utilise : d'après
  ses propres notes, le champ « joignable par courrier uniquement » est défini en s12 et seulement
  renseigné par s13.
- **minor — s35** — le critère « Quand le module vote est actif, ses actions réservées à la
  présidente […] sont présentes » est conditionné à s31, non déclarée en dépendance (délibérément,
  pour ne pas rendre une story du tronc commun otage d'une condition suspensive) et qui peut ne pas
  être livrée à temps. Tel quel, le critère est vide quand s31 est absente : l'écrire explicitement
  pour que la revue ne le lise pas comme un manque.
- **minor — synchronisation périmètre / PRD** — s05, s06 et s37 ne sont pas des lignes du tableau du
  périmètre. Elles sont justifiées ailleurs dans le PRD, mais constituent du périmètre non chiffré :
  soit ajouter les trois lignes à `docs/prd.md`, soit énoncer la dérivation dans chaque story.
- **minor — divergence PRD / stories sur la volumétrie** — les stories fixent **400 propriétaires
  dont 300 avec email** (arbitrage client du 6 septembre 2026, notes de s13), tandis que le PRD
  indique toujours « de quelques dizaines à ~300 par association » (ligne 49). Le test de seuil de
  s24 (300 vs 301), les ~800 documents/an de s30 et le dimensionnement de l'archive de s36 reposent
  tous sur le 400. Mettre le PRD à jour pour que les deux documents ne puissent pas diverger.

## Ce qui est notablement juste

À signaler parce que c'est rare : couverture complète du périmètre sans abandon silencieux ; zéro
fuite du cimetière malgré quatorze éléments enterrés ; un graphe de dépendances qui est un ordre
topologique propre ; chaque 4 portant un risque explicite ; et des notes agentiques qui nomment les
pièges du boilerplate (Resend/Brevo, Supabase/stockage local, Cache Components) au lieu de les
laisser découvrir à l'implémenteur.

## Verdict

Un major, sur `s01` — la toute première story à exécuter, là où le défaut coûte une édition markdown
aujourd'hui et une implémentation fourvoyée demain. Aucun critical : la couverture est complète et le
cimetière est intact.

Max severity: major
Stories ready: no
