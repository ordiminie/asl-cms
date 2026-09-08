# ⚠️ Documents de recherche hérités du boilerplate — ne pas implémenter

Les fichiers `s000-*.md` et `s001-*.md` de ce dossier **n'appartiennent pas à ASL-CMS**. Ils sont arrivés avec le code du boilerplate ShipSaaS lors de l'amorçage (merge `27d78f6`, 5 septembre 2026) et concernent le boilerplate lui-même, pas le projet de l'ASL La Fourche.

**Règle : ne jamais les implémenter, ni les traiter comme des stories du projet.** Leurs identifiants (`s000`, `s001`) appartiennent à la numérotation de l'auteur du boilerplate ; la nôtre commencera à `s01` dans `docs/stories.md`, qui reste à générer via `/ks-stories`.

| Fichier                              | Ce que c'est                                                                                       | Statut réel                                                                                                                                                                                                      |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `s000-cache-components-migration.md` | Migration du boilerplate vers le système de cache de Next.js 16                                    | **Déjà fait.** C'est la documentation du `cacheComponents: true` de `next.config.ts` et des `'use cache'` présents dans `src/`. Plan associé : `docs/plans/cache-components-migration.md`, 39/39 tâches cochées. |
| `s001-affiliate-system.md`           | Système de parrainage avec commissions pour le boilerplate (`ROADMAP.md` → « Admin - Affiliates ») | **Non commencé, et hors périmètre ASL-CMS.** Une association syndicale libre n'a pas de programme d'affiliation. Si l'auteur du boilerplate le développe, il arrivera par `git merge upstream/main`.             |

## À quoi ils servent quand même

Ce sont deux documents `/ks-research` de bonne facture : ancres de code vérifiées à un commit précis, critères d'acceptation testables, pièges d'idempotence sur les webhooks Stripe, sources lues plutôt que citées de mémoire. À garder comme **exemples de référence** au moment de produire nos propres recherches.

## Nos recherches à nous

Elles porteront le nom `docs/research/<story-id>.md` avec les ids définis dans `docs/stories.md` (format `s01-…`, `s02-…`), et voyageront sur la branche `feature/<id>` de leur story, conformément à `AGENTS.md`.

## Aux prochains merges upstream

Ces fichiers sont laissés en place volontairement : les supprimer créerait un conflit à chaque fois que l'auteur du boilerplate les met à jour. D'autres documents du même genre peuvent apparaître ici — appliquer la même règle, et compléter le tableau ci-dessus.
