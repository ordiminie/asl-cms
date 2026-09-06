# Revue du découpage en stories — ASL-CMS (Lp)

> Revue en contexte neuf de `docs/stories.md` face à `docs/prd.md`, par le subagent
> `stories-reviewer` (skill `stories-review` préchargée). Chaque constat est classé
> critical / major / minor.
>
> **Sixième passage** — 39 stories. Reviewer neuf, sans connaissance des passages précédents. Les
> deux majors du 5e passage sont levés (limitation de débit étendue à s10, invitation de s14
> redevenue transactionnelle). Deux majors subsistent, tous deux nés des correctifs du passage
> précédent : la désinscription livrée sans effet entre s24 et s26, et s37 qui porte deux valeurs
> utilisateur distinctes.
>
> Document de cadrage : committé sur la branche par défaut, contrairement à
> `docs/reviews/<id>.md` qui voyage avec sa branche de story.

## Couverture du périmètre

**Tronc commun — livré à toute association**

| Feature du PRD (core loop) | Couverte par | OK ? |
| --- | --- | --- |
| CMS de pages génériques (créer/modifier/publier/dépublier) | s04 | ✅ |
| Permissions par rôle configurables en back-office | s36 | ✅ |
| Connexion par lien magique (validité 4 h) | s03 (+ s14, s39 pour le flux d'invitation) | ✅ |
| Pages publiques + formulaire de contact archivé en BO | s08 (+ s04) | ✅ |
| Limitation de débit des formulaires publics | s08 (propriétaire), s10 (réutilise) | ✅ |
| Bandeau d'alerte global | s07 | ✅ |
| SEO (sitemap, métadonnées, Search Console) | s11 | ✅ |
| Import initial des membres d'une association | s13 | ✅ |
| Modèle membre ↔ parcelle daté | s12 | ✅ |
| Coordonnées (profil membre) | s15 | ✅ |
| Questions au bureau, catégories avec routage email | s22 (modèle de catégories : s10) | ✅ |
| Notes internes et historique par membre | s23 | ✅ |
| Import annuel des relevés d'eau + rapport d'erreurs email | s16 | ✅ |
| Historique de consommation d'eau par membre | s17 | ✅ |
| Signalements avec catégories et statuts | s10 (public) + s21 (membre) | ✅ |
| Publication des analyses d'eau | s09 | ✅ |
| Documents partagés | s30 | ✅ |
| Documents nominatifs en dossiers physiquement séparés | s31 | ✅ |
| Campagnes email Brevo (4 modèles + libre, gabarit commun) | s24 | ✅ |
| Envoi échelonné au-delà de 300 destinataires | s25 | ✅ |
| Relances d'impayés (3, à 3/2/1 semaines), activables | s28 | ✅ |
| Publipostage PDF pour les membres sans email | s27 | ✅ |
| Groupes de destinataires personnalisés | s26 | ✅ |
| Statistiques d'ouverture et de clic des campagnes | s29 | ✅ |
| Modèles de documents réutilisables | s35 | ✅ |
| Facturation membres : interface + implémentation Pennylane | s18 (interface + manuel) + s19 (Pennylane) | ✅ |
| Redirection de paiement | s20 | ✅ |
| Multi-tenant (Organization, config par tenant, RLS) | s01 (+ s02 pour la config) | ✅ |
| Export et portabilité des données | s37 | ✅ |

**Modules activables par tenant**

| Feature du PRD | Couverte par | OK ? |
| --- | --- | --- |
| Vote : interface + implémentation ASL Community | s32 | ✅ |
| Voirie | s33 | ✅ |
| Petites annonces entre membres | s34 | ✅ |

- [x] Chaque feature du tableau « Replicated (core loop) » est livrée par au moins une story —
  **32/32, aucun trou.**

## Périmètre

- [x] Aucune story ne réintroduit un élément du cimetière — vérifié ligne à ligne :
  électricité / gaz (absent), logique de vote (s32 l'exclut explicitement), traitement des paiements
  (s20 réduit au lien sortant, avec test sur le schéma), messagerie privée (s34 l'exclut),
  multi-immeubles / tantièmes (s18 l'exclut), plan B de connexion (s03, s27 et s39 le refusent
  nommément), carte interactive (s33 : image statique), IA (s31), Kanban (absent), messagerie dédiée
  (absent), une base par tenant (s01 : RLS), abstraction « ressource partagée » (s33 la refuse),
  WordPress (s04 renvoie à l'ADR 001).
- [~] Aucune story ne dépasse le périmètre — cinq dérivations hors du tableau, chacune argumentée
  dans sa story : s05 (actualités), s06 (présentation du bureau), s38 (simulation de rôle), le suivi
  d'adoption de s39, et l'export individuel membre de s37. Voir Constats (minor).

## Qualité des stories

- [x] Chaque story est une tranche livrable de bout en bout, pas une couche technique — aucune story
  « poser la base », « créer la couche API ». **Les briques transverses (adaptateur email Brevo,
  adaptateur de stockage, modèle de catégories, moteur PDF, motif d'import) sont attribuées à la
  première story qui en a besoin, avec le propriétaire nommé. C'est le point le plus fort du
  découpage.**
- [~] Chaque critère d'acceptation peut devenir un test — quatre exceptions (minors ci-dessous).
- [x] Notes agentiques présentes et utiles — dans les 39 stories, avec fichiers du boilerplate,
  pièges (cache, Resend→Brevo, Supabase→local, RLS / `BYPASSRLS`) et renvois `/ks-architect` et
  `/ks-design`.
- [~] Complexité renseignée ; aucune 5 non scindée ; chaque 4 énonce son risque — les six 4 (s01,
  s12, s28, s31, s36, s37) portent chacune un paragraphe « Risque (complexité 4) ». Répartition
  annoncée (3 / 15 / 15 / 6) vérifiée exacte. Réserve sur s37, voir Constats (major).

## La liste dans son ensemble

- [x] Ordre de dépendances exécutable : aucun cycle, aucune référence en avant — graphe vérifié arête
  par arête sur les 39 stories, toute dépendance déclarée pointe vers un id inférieur. **La
  circularité s03 → s12 → s03 signalée dans le document a bien été résolue par l'extraction de s14.**
  Le tableau récapitulatif est cohérent avec les sections `Dependencies` de chaque story.
- [x] Ids bien formés (`s<numéro>-<slug>`), uniques et stables — s01 à s39, numérotation contiguë,
  slugs kebab-case uniques, aucun doublon.
- [~] Aucun recouvrement entre stories — les recouvrements potentiels (limiteur de débit s08/s10,
  catégories s10/s22/s34, file de signalements s10/s21, invitation s03/s14/s39, moteur PDF s27/s35,
  factures s18/s19) sont tous arbitrés nommément avec un propriétaire unique. Une exception réelle :
  s24/s26 sur la désinscription.

## Constats

### Majors

- **major — s24 / s26** — s24 livre le lien de désinscription (critère 6 : « enregistre le refus du
  membre, le lui confirme à l'écran **en précisant ce qu'il continuera de recevoir** ») mais le
  filtrage effectif et la classification `facultative` / `statutaire` sont livrés par s26. **Entre
  s24 et s26, un membre qui se désinscrit continue de recevoir toutes les campagnes** : la story
  expédie une promesse affichée qu'elle n'honore pas, sur un sujet à charge réglementaire. Le critère
  de s24 référence par ailleurs en avant le modèle de nature qui n'existe qu'en s26 (« en précisant
  ce qu'il continuera de recevoir » suppose la classification). Soit s24 n'affiche pas le lien tant
  que s26 n'est pas là, soit le filtre minimal (désinscrit = exclu) descend en s24 et s26 n'ajoute
  que la nuance statutaire. En miroir, s26 porte dix critères pour trois valeurs distinctes (cible
  impayés / groupes nommés / classification et filtrage de désinscription) — la troisième est le
  morceau à replacer.
- **major — s37** — story cotée 4 qui se décrit elle-même comme « plus un export, [mais] une
  traversée de tout le produit » : 23 dépendances, exécution en tâche de fond, archive en flux sur un
  VPS à 4 Go, test de complétude qui inspecte le schéma des tables scopées, **et** un second usage
  utilisateur — « Un export individuel pour un membre donné produit ses seules données, au titre du
  droit d'accès ». Export association (présidente, portabilité et anti-verrouillage) et export
  individuel (droit d'accès RGPD) sont deux valeurs, deux utilisateurs, deux surfaces
  d'autorisation. **C'est le profil d'une 5 non scindée.** Sortir l'export individuel en story propre
  laisse s37 à sa vraie mission (complétude + isolation) et rend les deux livrables testables
  séparément.

### Minors

- **minor — s02** — critère « la clé `forage.responsable.email` vaut l'adresse du responsable du
  forage » : aucune valeur attendue n'est donnée, le test ne peut pas être écrit. Le critère jumeau
  sur `contact.email` donne bien sa valeur littérale.
- **minor — s14** — critère « sa valeur par défaut ne promet aucune fonctionnalité qui ne soit pas
  encore en ligne » : jugement éditorial, pas un comportement observable. Le document sait faire
  cette distinction ailleurs (s02 et s13 ont un bloc « À vérifier en review, pas en test ») — ce
  critère devrait y descendre.
- **minor — s03** — critère « Les rôles Membre, Bureau, Président(e) et SuperAdmin **existent** et
  déterminent ce qui est visible » : la première moitié décrit un état, pas un comportement. Seule la
  seconde (« un Membre n'atteint aucune page de back-office ») est testable.
- **minor — s07, s11** — les deux critères invoquent « l'espace membre » (bandeau affiché dessus ;
  `robots.txt` qui l'exclut) alors que l'espace membre n'existe qu'à partir de s12. Vérifiables
  seulement partiellement à leur position dans l'ordre.
- **minor — s02** — la story est écrite « En tant que membre du bureau » mais s'appuie, de son propre
  aveu, sur le rôle `admin` du boilerplate, le rôle Bureau n'arrivant qu'en s03. L'écart est
  documenté, il reste que la persona annoncée n'existe pas encore.
- **minor — s34** — dépendance déclarée sur s22 non justifiée : le modèle de catégories appartient à
  s10 (arbitrage explicite du document), et s34 n'utilise rien que s22 produise. Contrainte
  d'ordonnancement inutile.
- **minor — s37** — l'énumération du critère 3, présentée comme exhaustive, omet la configuration de
  la matrice de permissions par tenant (s36), qui est bien une donnée persistée scopée par
  `organization_id` ; s36 est également absente de la liste de dépendances. Le test de complétude
  rattraperait l'oubli, mais l'énumération et la liste devraient être cohérentes.
- **minor — s37** — les notes agentiques disent « vingt dépendances », le récapitulatif
  « vingt-trois » ; le décompte réel est 23.
- **minor — s01** — reste la tranche la plus large du découpage (création du tenant + routage par
  domaine + drapeaux de modules). La défense écrite est cohérente et l'extraction de s38 a déjà
  allégé la story ; à accepter en connaissance de cause plutôt qu'à ignorer.
- **minor — périmètre** — cinq dérivations hors du tableau « Replicated » : s05, s06, s38, le suivi
  d'adoption de s39 et l'export individuel de s37. Chacune est signalée comme telle et rattachée à un
  « Why kill it » ou à un critère de succès du PRD. Elles n'en ajoutent pas moins environ trois
  stories de portée non chiffrée au périmètre ; **un arbitrage humain explicite vaut mieux qu'une
  acceptation tacite.**

## Verdict

La couverture est complète et le cimetière est propre — les deux défauts qui coulent habituellement
un découpage sont absents. Ce qui bloque la validation : s24/s26 (une désinscription livrée sans
effet, plus une référence en avant vers une classification détenue par une story postérieure) et s37
(deux valeurs utilisateur et un périmètre de 5 dans une story cotée 4). Les deux se corrigent en
déplaçant des critères, pas en réécrivant le découpage.

Max severity: major
Stories ready: no
