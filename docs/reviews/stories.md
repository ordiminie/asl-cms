# Revue du découpage en stories — ASL-CMS (Lp)

> Revue en contexte neuf de `docs/stories.md` face à `docs/prd.md`, par le subagent
> `stories-reviewer` (skill `stories-review` préchargée). Chaque constat est classé
> critical / major / minor.
>
> **Neuvième passage** — second des deux passages de confirmation. 41 stories. Les quatre majors du
> 8e passage sont levés (prédicat « impayé » possédé par s19, échéance de facture, budget d'envoi
> quotidien, attribution des rôles en s14). **Premier passage rendant `Stories ready: yes`** : les
> majors restants sont des défauts de score et de formulation, pas des trous fonctionnels.
>
> Document de cadrage : committé sur la branche par défaut, contrairement à
> `docs/reviews/<id>.md` qui voyage avec sa branche de story.

## Couverture du périmètre

Parcours ligne à ligne des tableaux « Replicated (core loop) » du PRD (34 tronc commun + 3 modules
= 37 features).

| Feature du PRD (core loop)                                              | Couverte par                                                    | OK ? |
| ----------------------------------------------------------------------- | --------------------------------------------------------------- | ---- |
| CMS de pages génériques                                                 | s04                                                             | ✅   |
| Permissions par rôle configurables en BO                                | s37 (registre posé en s03)                                      | ✅   |
| Connexion par lien magique (4 h) + flux d'invitation + suivi d'adoption | s03 (auth) + s15 (invitation unitaire) + s41 (masse + adoption) | ✅   |
| Pages publiques + formulaire de contact archivé en BO                   | s04 + s08                                                       | ✅   |
| Limitation de débit des formulaires publics                             | s08 (livré) + s10 (réutilisé)                                   | ✅   |
| Actualités (mini-blog daté)                                             | s05                                                             | ✅   |
| Présentation du bureau (fiches listables)                               | s06                                                             | ✅   |
| Désinscription et classification des communications                     | s25 (lien + exclusion) + s27 (classification / réintégration)   | ✅   |
| Bandeau d'alerte global                                                 | s07                                                             | ✅   |
| SEO (sitemap, métadonnées, Search Console)                              | s11                                                             | ✅   |
| Import initial des membres                                              | s13                                                             | ✅   |
| Modèle membre ↔ parcelle daté                                           | s12                                                             | ✅   |
| Coordonnées (profil membre)                                             | s16 (self-service) + s12 (bureau)                               | ✅   |
| Questions au bureau, catégories avec routage email                      | s23 (modèle de catégories en s10)                               | ✅   |
| Notes internes et historique par membre                                 | s24                                                             | ✅   |
| Import annuel des relevés d'eau + rapport email                         | s17                                                             | ✅   |
| Historique de consommation d'eau par membre                             | s18                                                             | ✅   |
| Signalements avec catégories et statuts (public + membre)               | s10 + s22                                                       | ✅   |
| Publication des analyses d'eau                                          | s09                                                             | ✅   |
| Documents partagés                                                      | s31                                                             | ✅   |
| Documents nominatifs en dossiers physiquement séparés                   | s32                                                             | ✅   |
| Campagnes email Brevo (4 modèles + libre, gabarit commun)               | s25                                                             | ✅   |
| Envoi échelonné au-delà de 300                                          | s26                                                             | ✅   |
| Relances d'impayés (3, activables)                                      | s29                                                             | ✅   |
| Publipostage PDF                                                        | s28                                                             | ✅   |
| Groupes de destinataires personnalisés                                  | s27                                                             | ✅   |
| Statistiques d'ouverture et de clic                                     | s30                                                             | ✅   |
| Modèles de documents réutilisables                                      | s36                                                             | ✅   |
| Facturation membres : interface + Pennylane                             | s19 (interface + manuel) + s20 (Pennylane)                      | ✅   |
| Redirection de paiement                                                 | s21                                                             | ✅   |
| Multi-tenant (Organization, config par tenant, RLS)                     | s01 + s02                                                       | ✅   |
| Export individuel d'un membre (droit d'accès)                           | s39                                                             | ✅   |
| Simulation de rôle SuperAdmin                                           | s40                                                             | ✅   |
| Export et portabilité des données                                       | s38                                                             | ✅   |
| Module Vote (interface + ASL Community)                                 | s33                                                             | ✅   |
| Module Voirie                                                           | s34                                                             | ✅   |
| Module Petites annonces                                                 | s35                                                             | ✅   |

- [x] Chaque feature du tableau « Replicated (core loop) » est livrée par au moins une story —
      **37/37, aucun trou.**

## Périmètre

- [x] Aucune story ne réintroduit un item du cimetière. Les 16 entrées ont été vérifiées ; chacune
      des risquées est activement clôturée par un critère ou une note (s21 teste l'absence de tout champ
      de moyen de paiement dans le schéma ; s33 interdit tout dépouillement ; s34 conserve l'image
      statique ; s35 interdit la messagerie privée ; s28 et s41 affirment que le courrier n'est **pas**
      un plan B de connexion ; s01 confirme base partagée + RLS ; s32 exclut la classification IA).
- [ ] Aucune story ne dépasse le périmètre — trois étirements réels quoique bien argumentés : le
      budget d'envoi quotidien de s26, la génération en lot de s36, et s14 (attribution des rôles) qui
      n'a aucune ligne au PRD.

## Qualité des stories

- [x] Chaque story est une tranche livrable de bout en bout — aucune story « poser la base »,
      « créer la couche API ». s19/s20 et s25/s26/s27 se scindent selon des lignes de valeur, pas de
      couches. s01 est la plus proche de l'infrastructure mais livre une capacité SuperAdmin réelle.
- [ ] Chaque critère peut devenir un test — un critère se déclare lui-même non testable (s20 #3), un
      autre énumère des stories non livrées (s26 #6), un champ est livré sans critère qui l'exerce (s10,
      auto-déclaré).
- [x] Notes agentiques présentes et utiles — constamment solides : chemins du boilerplate, pièges de
      cache, pièges des adaptateurs de stockage et d'email, séparations explicites « à vérifier en
      review, pas en test ». **Meilleure partie de ce découpage.**
- [ ] Complexité chiffrée ; aucune 5 non scindée ; chaque 4 énonce son risque — aucune 5, et les six
      4 (s01, s12, s29, s32, s37, s38) énoncent leur risque. Mais deux scores paraissent faux, en sens
      inverses (s26 sous-évaluée, s38 possiblement une 5).

## La liste dans son ensemble

- [x] Ordre de dépendances exécutable — les 41 listes ont été vérifiées : chaque dépendance déclarée
      pointe vers un id strictement inférieur. Aucun cycle. La circularité s03 → s12 → s03 signalée
      auparavant est réellement résolue par l'extraction de s15.
- [x] Ids bien formés, uniques et stables — `s01`..`s41`, tous en `s<numéro>-<slug>`, kebab-case,
      aucun doublon.
- [x] Aucun recouvrement — les paires risquées sont chacune clôturées par un énoncé de propriété :
      s08/s23 (deux modèles de contact), s12/s16 (coordonnées, deux points d'entrée), s10/s22 (un seul
      modèle de signalement), s10/s23/s35 (un seul modèle de catégories, propriété s10), s25/s27
      (ciblage), s28/s36 (un seul moteur PDF), s38/s39 (deux utilisateurs d'export), s14/s37/s40
      (attribuer vs configurer vs emprunter).

## Constats

### Majors

- **major — s01** — le critère 5 (« Le provisioning désigne l'administrateur initial… **il reçoit son
  accès** et peut ensuite administrer le site ») fait une référence en avant vers du travail détenu
  par des stories ultérieures. s01 déclare `Dependencies: Aucune` et ses propres notes disent « Les
  rôles propres à l'association et le magic link arrivent en s03. **Ne pas anticiper s03 ici** »,
  tandis que les notes de s03 disent « C'est **la première story qui envoie un email** ». À la
  livraison de s01, l'administrateur désigné n'a donc aucun moyen vérifiable de recevoir son accès —
  ou bien s01 livre un second chemin d'envoi (Resend) que s03 devra remplacer. Reformuler le critère
  sur ce que s01 peut prouver seule (le compte existe, est rattaché au tenant, porte les droits
  d'administration) et déplacer « reçoit son accès » vers s03 ou s15.
- **major — s26** — sous-évaluée à 3, et son risque n'est pas énoncé. Ses critères exigent, dans une
  seule tranche : une planification durable survivant à un redémarrage, l'idempotence par
  destinataire, un **budget d'envoi quotidien partagé par tous les emails sortants du tenant**
  (décompté dans l'adaptateur que toutes les autres stories traversent) **et** une file de report
  avec état « en attente » visible. C'est le même trio (planification + idempotence + ciblage) qui
  vaut un 4 à s29, plus un budget transverse. Soit la chiffrer 4 avec son risque écrit, soit séparer
  le budget et la file de report de la scission de campagne sur deux jours.
- **major — s26 #6** — le critère de budget énumère des émetteurs qui n'existent pas encore :
  « décompté par **tous** les emails sortants — invitations (s15), campagnes (s25), relances
  (**s29**), lancement (**s41**) ». s29 et s41 sont livrées après s26 : le critère n'est pas
  vérifiable à la livraison. Le réénoncer sur l'adaptateur d'envoi (« tout email sortant traversant
  l'adaptateur », prouvé avec un émetteur de test), et laisser s29 et s41 porter leur propre critère
  affirmant qu'elles le traversent.
- **major — s38** — le score 4 est douteux ; cela se lit comme une 5 déjà scindée une fois (s39) mais
  pas assez. La story groupe le moteur d'export et ses formats ouverts, sept familles de contenu
  d'archive couvrant presque toutes les tables du produit, un harnais de complétude par introspection
  de schéma, l'exécution en tâche de fond avec notification, et l'écriture en flux sur un VPS à
  4 Go — derrière 24 dépendances. Le document a lui-même employé l'argument de la « 5 déguisée en 4 »
  pour extraire s39 ; le même argument s'applique de nouveau. Réexaminer la scission (le harnais de
  complétude et l'exécution asynchrone avec notification sont des tranches séparables et prouvables)
  avant `/ks-plan`.

### Minors

- **minor — s20 #3** — « ce critère ne devient testable qu'une fois cette clé choisie » est un
  critère d'acceptation qui admet ne pas en être un. Acceptable vu la condition suspensive, mais à
  formuler comme un prérequis `/ks-research` de la story, pas comme une case à cocher.
- **minor — s10** — auto-déclaré : le champ `email_destination` est livré avec « **aucun critère de
  cette story ne l'exerce** : sa preuve vit en s23 ». Une story qui persiste un champ qu'elle ne
  teste pas est exactement la dérive que les critères servent à prévenir. Soit ajouter un critère ici
  (une catégorie porte une adresse de routage et elle survit à un aller-retour), soit reporter la
  colonne à s23.
- **minor — s31** — le dernier paragraphe des notes de s31 appartient à s32 : « La dépendance sur s31
  n'est pas fonctionnelle mais technique : **cette story** réutilise la route de service
  authentifiée… la propriété la plus importante de **s32**. » Tel quel, s31 documente une dépendance
  sur elle-même. Erreur de copie.
- **minor — s38** — la liste de dépendances et l'énumération du contenu d'archive omettent **s14**,
  alors que les notes de s14 disent « Chaque attribution et chaque retrait est tracé… **Elle entre
  dans l'export de s38 comme le reste** ». Même question pour l'état d'invitation et d'adoption de
  s15. Le test de complétude les rattraperait mécaniquement, mais la liste déclarée est présentée
  comme exhaustive par le raisonnement de la story elle-même.
- **minor — s14** — aucune ligne correspondante dans le tableau du périmètre du PRD. La story est
  clairement nécessaire (rien d'autre ne désigne la présidente ni le bureau après l'import) et bien
  argumentée, mais c'est un ajout au périmètre : il devrait apparaître dans `docs/prd.md`, pas
  seulement dans `docs/stories.md`.
- **minor — s26 / s36** — deux étirements au-delà de leur ligne du PRD, tous deux défendables,
  aucun consigné au PRD : le budget quotidien généralise « Envoi échelonné au-delà de 300
  destinataires — scission automatique sur deux jours », et le critère 3 de s36 (génération en lot
  déposée dans les dossiers nominatifs, tirant s27 + s28 + s32) dépasse « Modèles de documents
  réutilisables — convocation, PV, courrier type ». Les remonter au PRD pour que le périmètre reste
  la source unique de vérité.
- **minor — s02 #4** — le critère affirme les adresses littérales de La Fourche
  (`contact@asl-exemple.test`, `responsable-forage@asl-exemple.test`) comme test d'acceptation d'une story
  produit. C'est testable, et les données de seed sont légitimes, mais cela lie la suite de tests
  d'une story du tronc commun aux données d'un seul tenant ; affirmer le mécanisme de seed plutôt que
  les valeurs du client.
- **minor — s14 slug** — `s14-attribuer-les-roles` porte un article là où les autres slugs sont des
  verbe-nom nus. Purement cosmétique ; les ids sont par ailleurs bien formés et uniques.

## Verdict

La couverture est complète et le cimetière est propre — les deux défauts qui auraient été critiques
sont absents. Ce qui reste relève du score et de la formulation, concentré sur s01, s26 et s38, et se
corrige en éditant du markdown avant que la moindre recherche ne commence.

Max severity: major
Stories ready: yes
