# ADR 026 — Analyses d'eau : une soumission, deux fichiers et une ligne

- Status: accepted
- Date: 2026-09-24
- Scope: story s09-analyses-eau
- S'appuie sur l'ADR 023 (chaîne de fichiers de contenu partagée), qu'elle ne modifie pas.

## Context

Le critère 4 de s09 est explicite : le formulaire « ne demande que les quatre champs (date, affiche,
texte facultatif, PDF) et publie en **une seule soumission**, sans étape intermédiaire ». La
publication est mensuelle, faite par des bénévoles : la rapidité de saisie est l'exigence dominante,
et c'est un critère de recette du PRD.

Or les deux précédents livrés font exactement l'inverse.

- **s04** dépose chaque fichier de bloc **immédiatement**, par une action dédiée, sur une page
  **déjà créée** : `uploadPageBlockFileService` exige un `pageId` et vérifie que la page existe.
- **s05** fait de même pour l'image d'une actualité, et l'assume : le dépôt rend une clé que le
  formulaire garde jusqu'à l'enregistrement, pour qu'une actualité déjà publiée ne serve pas une
  nouvelle image avec l'ancien texte alternatif.

Les deux reposent sur la même prémisse : **la ligne existe avant le fichier**, parce que la clé de
stockage contient l'identifiant du propriétaire
(`{organizationId}/{portée}/{ownerId}/{slotId}-{uuid}.{ext}`, ADR 023). s09 ne peut pas s'y
conformer : il n'y a **ni brouillon, ni étape intermédiaire**, donc aucune ligne à qui rattacher un
fichier au moment du dépôt.

Trois forces s'ajoutent :

1. **Deux fichiers obligatoires**, pas un. L'affiche et le PDF sont tous deux exigés par `V5 §4.4` ;
   seul le texte est facultatif. Une soumission partiellement écrite est donc possible : un fichier
   posé, l'autre non, la ligne absente.
2. **Le système de fichiers et Postgres ne partagent pas de transaction.** Aucun `db.transaction()`
   ne peut annuler un fichier écrit sur le disque du VPS (ADR 004).
3. **L'enveloppe de la requête devient bloquante.** Deux fichiers dans le même corps, sous une limite
   de Server Action fixée à 2 Mo par s01b pour un logo de 1 Mo. La décision du 23/09/2026 de
   `docs/architecture.md` (enveloppe à 16 Mo) existe précisément à cause de cette story ; elle est
   rappelée ici, elle n'est pas reprise.

Une décision est nécessaire maintenant : s06 (fiches du bureau) et toute story qui déposera un
fichier dans le même geste que sa création hériteront de la forme retenue ici.

## Decision

**Une publication d'analyse d'eau est une seule opération : les champs et les deux fichiers arrivent
dans la même requête, et l'écriture est ordonnée fichiers → ligne, avec compensation sur échec.**

1. **L'identifiant de la ligne est généré par le serveur avant l'insertion.** Le service produit un
   UUID, le passe à `buildContentFileKey` comme `ownerId` pour les deux emplacements (`poster`,
   `report`), puis le fournit explicitement à l'insertion. La chaîne de fichiers de l'ADR 023 est
   réemployée **sans modification** : s09 se contente de déclarer sa portée `water-analysis` et ses
   deux colonnes `poster_key` / `report_key`, et n'écrit ni validation de clé, ni route de lecture.
2. **Ordre d'écriture, et lui seul** : validation des deux fichiers par signature binaire → écriture
   de l'affiche → écriture du PDF → insertion de la ligne. Si l'insertion échoue, **les deux fichiers
   tout juste écrits sont supprimés**, et l'erreur est propagée. Un refus de validation (format,
   poids, date future, texte trop long) n'écrit **rien du tout**, pas même le premier fichier.
   C'est le patron de `association-identity-service.ts` (s01b), étendu à deux fichiers.
3. **À la correction** : le nouveau fichier est écrit, la ligne mise à jour, **puis** l'ancien
   fichier supprimé. Un échec de cette dernière suppression laisse un orphelin **journalisé**, jamais
   une référence cassée. À la suppression d'une analyse : la ligne d'abord, les deux fichiers ensuite.
   L'invariant, dans les trois cas : **une ligne ne pointe jamais vers un fichier absent.** Un fichier
   sans ligne est un coût de disque, pas une panne.
4. **Le modèle `water_analysis` n'a ni colonne `status`, ni colonne `image_alt`.**
   - Pas de statut : la publication est directe (critère 4) et la suppression est définitive (design
     validé). Une colonne que rien ne fait changer est un état fantôme, qu'un lecteur prendrait pour
     une fonctionnalité.
   - Pas de texte alternatif stocké : le critère 4 interdit un cinquième champ, et l'`alt` est
     **dérivé de `sampled_on` au rendu** (« Affiche de l'analyse d'eau du 2 septembre 2026 »).
     Corriger la date corrige l'`alt` du même coup ; aucune valeur ne peut diverger de l'autre.
     C'est une **dette d'accessibilité assumée et consignée** (gap 4 du design) : une affiche
     d'analyse porte souvent ses résultats en texte dans l'image, et le texte facultatif comme le PDF
     sont les seuls recours.

## Considered options

- **Créer un brouillon à l'ouverture du formulaire, puis déposer les fichiers dessus** (patron s05) —
  rejeté : c'est exactement l'« étape intermédiaire » que le critère 4 interdit, et cela laisserait
  des lignes fantômes derrière chaque formulaire abandonné, sur un modèle qui n'a pas de statut pour
  les distinguer.
- **Déposer les fichiers d'abord, sous une clé « sans propriétaire », puis les déplacer à
  l'insertion** — rejeté : le déplacement change la clé, donc la validation de préfixe de l'ADR 023
  devrait accepter une zone hors portée, et une reprise après échec devrait balayer cette zone. On
  remplacerait une compensation de trois lignes par un état transitoire à surveiller.
- **Envelopper l'écriture des fichiers et l'insertion dans une transaction** — rejeté : impossible.
  `db.transaction()` ne couvre pas le disque ; un `ROLLBACK` laisserait les deux fichiers en place.
  La compensation explicite est la seule garantie disponible, et l'ordre choisi rend son échec
  bénin.
- **Une colonne `status` par symétrie avec `news`** — rejeté : symétrie sans usage. Aucun critère ne
  demande de brouillon ni de dépublication, et une valeur unique dans un enum invite à écrire du code
  pour les autres.
- **Un cinquième champ « texte alternatif »**, comme s05 — rejeté : écart direct au critère 4, sur
  une story dont l'exigence dominante est la rapidité de saisie.
- **Un plafond de poids propre à s09, plus bas que celui de la chaîne partagée** — rejeté : les
  plafonds affichés sont ceux réellement appliqués (5 Mo image, 10 Mo document,
  `CONTENT_FILE_MAX_BYTES`). Un plafond local divergerait en silence du reste du produit.

## Consequences

**Ce qui devient plus simple**

- Le bureau publie en un geste : quatre champs, un bouton, rien à enregistrer avant de déposer.
- Aucune ligne fantôme, aucun statut à expliquer dans une interface destinée à des bénévoles.
- L'`alt` ne peut pas contredire la date affichée.

**Ce qui devient plus difficile**

- L'enveloppe de requête devient un réglage **global** : `serverActions.bodySizeLimit` et
  `proxyClientMaxBodySize` à 16 Mo concernent toutes les Server Actions du produit, pas seulement
  celle-ci. `proxyClientMaxBodySize` est indispensable : au-delà de 10 Mo par défaut, le proxy
  **tronque** le corps avec un simple avertissement — un fichier corrompu plutôt qu'un refus.
- Une soumission volumineuse voyage entièrement avant d'être refusée : un PDF de 11 Mo est téléversé
  puis rejeté. Le contrôle côté client l'évite dans le cas normal ; le serveur reste l'arbitre.
- Le code de publication porte une compensation à la main, que les tests doivent couvrir
  explicitement (insertion en échec → les deux fichiers supprimés).

**À surveiller**

- **Orphelins de stockage** après un échec de suppression. Journalisés, sans conséquence
  fonctionnelle ; l'inventaire des clés de s12c les verra.
- **Le serveur web du VPS (s12b) a sa propre limite de corps** et tronque au-delà : à vérifier au
  moment de la mise en ligne, sans quoi le plafond de 16 Mo n'existera que dans Next.
- **Le poids de la page publique** : dix affiches de 5 Mo au plus. `loading="lazy"` limite le coût
  réel ; le remède durable est le redimensionnement à l'écriture **borné en largeur** (ADR 024),
  appliqué aux affiches par une story ultérieure — jamais un recadrage carré, qui rendrait une
  affiche illisible.
