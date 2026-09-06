# Revue du découpage en stories — ASL-CMS (Lp)

> Revue en contexte neuf de `docs/stories.md` face à `docs/prd.md`, par le subagent
> `stories-reviewer` (skill `stories-review` préchargée). Chaque constat est classé
> critical / major / minor.
>
> Document de cadrage : committé sur la branche par défaut, contrairement à
> `docs/reviews/<id>.md` qui voyage avec sa branche de story.

## Couverture du périmètre

Parcours ligne à ligne du tableau du PRD (et non des stories — l'inverse masquerait les oublis).

**Tronc commun**

| Feature du PRD (core loop) | Couverte par | OK ? |
| --- | --- | --- |
| CMS de pages génériques (créer/modifier/publier/dépublier) | s04 | ✅ |
| Permissions par rôle configurables en back-office | s35 | ✅ |
| Connexion par lien magique (validité 4 h) | s03 | ✅ |
| Pages publiques + formulaire de contact archivé en BO | s04, s05, s06, s08 | ✅ |
| Bandeau d'alerte global | s07 | ✅ |
| SEO (sitemap, métadonnées, Search Console) | s11 | ✅ |
| Modèle membre ↔ parcelle daté | s12 | ✅ |
| Coordonnées (profil membre) | s14 | ✅ |
| Questions au bureau, catégories avec routage email | s21 | ✅ |
| Notes internes et historique par membre | s22 | ✅ |
| Import annuel des relevés d'eau + rapport d'erreurs email | s15 | ✅ |
| Historique de consommation d'eau par membre | s16 | ✅ |
| Signalements avec catégories et statuts (public + membre) | s10, s20 | ✅ |
| Publication des analyses d'eau | s09 | ✅ |
| Documents partagés (statuts, PV, ordres du jour) | s29 | ✅ |
| Documents nominatifs en dossiers physiquement séparés | s30 | ✅ |
| Campagnes email Brevo (4 modèles + libre, gabarit commun) | s23 | ✅ |
| Envoi échelonné au-delà de 300 destinataires | s24 | ✅ |
| Relances d'impayés (3, à 3/2/1 semaines), activables par tenant | s27 | ✅ |
| Publipostage PDF pour les membres sans email | s26 | ✅ |
| Groupes de destinataires personnalisés | s25 (partiel — voir major #2) | ⚠️ |
| Statistiques d'ouverture et de clic des campagnes | s28 | ✅ |
| Modèles de documents réutilisables | s34 | ✅ |
| Facturation membres : interface + implémentation Pennylane | s17, s18 | ✅ |
| Redirection de paiement | s19 | ✅ |
| Multi-tenant (Organization, config par tenant, RLS) | s01, s02 | ✅ |
| Export et portabilité des données | s36 | ✅ |

**Modules activables par tenant**

| Feature du PRD | Couverte par | OK ? |
| --- | --- | --- |
| Vote : interface + implémentation ASL Community | s31 | ✅ |
| Voirie | s32 | ✅ |
| Petites annonces entre membres | s33 | ✅ |

- [x] Chaque feature du tableau « Replicated (core loop) » est livrée par au moins une story —
  **aucune feature non couverte, aucun défaut critique de couverture.** Une ligne (Groupes de
  destinataires) n'est que partiellement livrée : sa base de départ déclarée (« au-delà des deux
  cibles actuelles : tous / impayés ») n'est pas entièrement réalisée.

## Périmètre

- [x] Aucune story ne réintroduit un élément du cimetière du PRD. Les 16 entrées ont été vérifiées.
  Plusieurs stories ferment activement la porte : s19 (aucun traitement de paiement), s31 (aucune
  logique de vote, ni quorum ni procurations), s32 (plan statique uniquement), s33 (pas de messagerie
  privée), s30 (pas de classification IA), s01 (base partagée + RLS). Le « ligne sans email → fiche
  sans compte, joignable par courrier » de s13 est conforme à « aucun plan B de connexion », ce n'est
  pas une fuite.
- [ ] Aucune story ne dépasse le périmètre — **s13 (import initial des membres) n'a pas de ligne dans
  le tableau « Replicated » du PRD.** Elle est défendable (CDC §2, nécessaire au provisioning d'un
  client) mais n'a jamais été chiffrée au périmètre, et elle porte désormais un attribut structurant
  (voir major #3).

## Qualité des stories

- [x] Chaque story est une tranche livrable de bout en bout, pas une couche technique. Pas de
  « monter la base », pas de « créer la couche API ». s01 et s02 sont les plus proches de la
  plomberie, mais chacune porte une valeur d'usage réelle (une association provisionnée, un bureau
  qui édite ses propres réglages).
- [ ] Chaque critère d'acceptation peut devenir un test — plusieurs critères sont subjectifs ou
  relèvent de la revue humaine (voir les minors).
- [x] Notes agentiques présentes et utiles dans les 36 stories : fichiers du boilerplate nommés,
  pièges signalés (Resend→Brevo, Supabase→stockage local, pièges `'use cache'`, `pnpm test --run`),
  rappels du cimetière en ligne.
- [x] Complexité renseignée ; aucun 5 ; les cinq 4 (s01, s12, s27, s30, s35) explicitent chacun leur
  risque dans les notes agentiques.

## La liste dans son ensemble

- [x] Ordre de dépendances exécutable : toute dépendance déclarée pointe vers l'amont, aucun cycle,
  aucune référence en avant. Le tableau récapitulatif correspond aux sections `Dependencies` de
  chaque story (les 36 vérifiées).
- [x] Ids bien formés (`s<numéro>-<slug>`), uniques, stables — s01…s36, aucun doublon, aucune
  collision.
- [x] Aucun recouvrement réel : les paires à risque (s08/s21 contact vs questions, s10/s20
  signalement public vs membre, s04/s05/s06/s09 contenus répétables, s26/s34 moteur PDF, s23/s34
  modèles d'email vs de documents) sont chacune explicitement désambiguïsées dans les notes.

## Constats

### Majors

- **major — s35** — `s35-permissions-configurables` (tronc commun, complexité 4 au PRD) déclare son
  unique dépendance sur `s31-vote-asl-community`, un **module activable explicitement bloqué par une
  condition suspensive non levée** (accès ASL Community + validation statutaire). Cela contredit
  l'affirmation de s31 elle-même : « Le module étant activable, son décalage n'empêche aucune autre
  story » — il en bloque exactement une, et c'est une feature du tronc commun. Deux issues : retirer
  la dépendance (les restrictions présidentielles deviennent des lignes par défaut de la matrice), ou
  corriger le tableau des dépendances bloquantes.
- **major — couverture / s23, s25, s27** — **la cible « impayés » n'a pas de propriétaire.** La ligne
  du PRD « Groupes de destinataires personnalisés » se définit comme allant *au-delà* des deux cibles
  actuelles (tous / impayés) ; or s23 n'envoie qu'« aux membres disposant d'une adresse email », s25
  exclut explicitement la segmentation dynamique (« Pas de segmentation dynamique par critère »), et
  s27 ne calcule le sous-groupe impayés qu'en interne, pour les relances **automatiques**. Le modèle
  « relance manuelle » listé dans les notes de s23 n'a donc aucun moyen d'atteindre les impayés.
- **major — s12** — **aucun critère d'acceptation ne couvre un membre sans email**, alors que le PRD
  en fait une population de premier plan (angle n°2, ~100 sur 400). Le marquage « joignable par
  courrier uniquement » n'apparaît que dans s13 (import réalisé par le prestataire) : un membre créé
  manuellement par le bureau en s12 ne peut pas être marqué, et s26 (publipostage) dépend de ce champ
  explicite. L'attribut appartient à la story du modèle membre, pas à celle de l'import.

### Minors

- **minor — s13** — story hors du tableau « Replicated » du PRD ; le périmètre devrait porter une
  ligne pour l'import initial des membres plutôt que de le voir apparaître au seul découpage.
- **minor — s24, s27, s23** — lisent des paramètres de tenant (seuil d'envoi, activation des
  relances, logo et mentions du gabarit) sans déclarer s02 en dépendance. L'ordre d'exécution les
  sauve, mais les listes déclarées sont incomplètes.
- **minor — s27** — le critère « les membres en impayé sans email … sont orientés vers le
  publipostage » référence s26, absente de sa liste de dépendances.
- **minor — s24** — le seuil de 300 est un littéral dans deux critères d'acceptation ; seules les
  notes disent qu'il doit être un paramètre de tenant. Au regard de la règle transverse « rien en
  dur », cela devrait être un critère.
- **minor — s19, s18** — « Aucune donnée bancaire n'est saisie, transmise ni stockée — vérifié par
  revue de la story » est une consigne de revue, pas un test. Un négatif de cette forme ne peut pas
  devenir un critère automatisable : énoncer ce qui **est** affirmé (lien sortant uniquement, aucun
  champ de paiement dans le formulaire ni dans le schéma).
- **minor — s18** — « Le téléchargement du PDF est proposé **si l'API le permet** » est conditionné à
  un inconnu ; tel quel, le critère ne peut pas devenir un test déterministe. À scinder en deux
  comportements observables une fois l'API connue.
- **minor — s08, s06, s09, s36** — critères subjectifs : « freinée sans bloquer un visiteur
  légitime » (aucun seuil), « sans casser la mise en page ni laisser d'espace vide », « tient dans un
  seul écran », « ne bloque pas le reste du site ».
- **minor — s31** — la story est intitulée « ouvrir le vote à distance » mais aucun critère ne couvre
  l'ouverture ni la fermeture de la période de vote, ni l'URL de vote externe comme paramètre de
  tenant (malgré la dépendance déclarée sur s02).
- **minor — s01** — regroupe quatre valeurs distinctes (création de tenant, activation de modules,
  isolation RLS, simulation de rôle SuperAdmin) à complexité 4. La simulation de rôle répond au
  besoin d'un autre utilisateur et constitue une tranche candidate à part entière.
- **minor — s35 / s36** — la matrice de permissions est délibérément placée tard pour se dériver
  d'actions réelles et existantes, mais s36 introduit **après** elle une nouvelle action réservée à la
  présidente (déclencher l'export). Soit ordonner s36 avant s35, soit écrire que la matrice doit être
  étendue par les stories ultérieures.
- **minor — s36** — la note agentique parle de « documents nominatifs de 300 membres » alors que s13
  et s30 fixent le comptage à 400 propriétaires (300 comptes). Le document insiste sur cet arbitrage ;
  la note de volumétrie le contredit.

## Verdict

La couverture est réellement complète face au tableau du périmètre du PRD, et le cimetière est
respecté avec une discipline inhabituelle — **aucun critical**. Ce qui bloque la validation : une
dépendance qui rend une feature du tronc commun otage d'un module suspendu, une capacité du périmètre
(cible « impayés ») tombée entre trois stories, et un attribut membre porté par la mauvaise story.

Max severity: major
Stories ready: no
