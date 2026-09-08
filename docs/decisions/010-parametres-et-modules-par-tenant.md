# ADR 010 — Paramètres et activation de modules par association

- Status: accepted
- Date: 2026-09-08
- Scope: framing

## Context

Le PRD pose un critère de succès vérifiable en revue : « aucune donnée propre à La Fourche n'est codée en dur — adresses de notification, catégories, seuils, activation des relances ». Et un autre, mesurable : « une deuxième association est provisionnée sans écrire une ligne de code ». Les stories reprennent la règle en transverse : « une valeur codée en dur est un échec de review ».

Le boilerplate offre bien un magasin de réglages, mais **global** : `src/db/models/app-settings-model.ts` définit `appSettings` avec `key: text('key').primaryKey()`. La clé seule est la clé primaire — il n'y a pas de dimension tenant. Deux associations ne peuvent pas y avoir deux valeurs différentes pour la même clé.

Par ailleurs s01 exige des drapeaux d'activation de modules, avec une conséquence forte : « une route rattachée à un module inactif, ou à une clé de module inconnue, répond 404 — pas un lien masqué, pas une page vide ».

Une piste tentante existe : `organization.metadata` (colonne `text`) et `organization.limitOverrides` (colonne `json`) sont déjà là.

## Decision

Deux mécanismes distincts, parce que ce sont deux natures de données différentes.

**1. Paramètres d'association** — une table `organization_setting` scopée tenant, sur le modèle de `app_settings` mais avec une clé composite `(organization_id, key)`, et les colonnes `value`, `type`, `category`, `label`, `description`. Elle porte les adresses de notification, les catégories, les seuils, les textes par défaut. Elle est couverte par RLS comme toute table métier.

`app_settings` global est **conservé** pour ce qui relève réellement de la plateforme (réglages Zourite Studio), et les deux ne se confondent pas : une valeur qui diffère d'une association à l'autre n'a rien à faire dans `app_settings`.

**2. Activation de modules** — une colonne dédiée sur `organization`, typée par un énuméré de clés de modules connues, et non un champ libre. Le contrôle vit dans **un helper unique** appelé en tête des routes et des Server Actions concernées, qui appelle `notFound()` si le module est inactif ou la clé inconnue. Un module inconnu est traité comme inactif : c'est ce qui rend le comportement de s01 vrai pour une clé fictive comme pour un module réel désactivé.

## Considered options

- **Étendre `app_settings` avec une colonne `organization_id` nullable** — rejeté : mélange deux portées dans une table, et fait dépendre l'isolation d'un `NULL` significatif. Une policy RLS sur une colonne nullable est un piège classique — `organization_id = current_setting(...)` est faux pour `NULL`, donc les réglages globaux deviendraient invisibles à l'application. Deux tables évitent le problème au lieu de le contourner.
- **Stocker les paramètres dans `organization.metadata`** — rejeté : c'est une colonne `text`, donc du JSON non typé, non indexable, non validable et non requêtable. Elle est utilisable pour de la donnée d'appoint, pas pour la configuration dont dépend le critère « rien en dur ».
- **Réutiliser `limitOverrides` (json) pour les drapeaux de modules** — rejeté : cette colonne est typée `Record<string, number>` et sert les limites d'abonnement Stripe. Y loger des booléens de modules confondrait facturation plateforme et périmètre fonctionnel, deux choses que le PRD demande explicitement de ne jamais confondre.
- **Fichier de configuration par tenant, versionné dans le dépôt** — rejeté : provisionner une association demanderait un déploiement, ce qui casse le critère « sans écrire une ligne de code ». Et le bureau doit pouvoir modifier ses propres adresses de notification depuis le back-office (CDCT §4.6).
- **Masquer les liens des modules inactifs sans bloquer les routes** — rejeté explicitement par s01. Masquer un lien n'est pas désactiver un module : l'URL reste atteignable.

## Consequences

**Ce qui devient plus simple**

- « Rien de propre à La Fourche en dur » devient vérifiable mécaniquement : toute constante métier a un endroit où vivre, et une revue peut chercher son absence.
- Provisionner la deuxième association est une insertion de lignes, ce que le critère de succès demande.
- Le bureau modifie ses adresses de notification et ses catégories lui-même, sans le prestataire.

**Ce qui devient plus difficile**

- Chaque paramètre doit être déclaré avec une valeur par défaut sensée. Une clé absente au provisioning est un comportement indéfini au premier usage — d'où l'importance du seed de provisioning.
- La lecture d'un paramètre devient un appel asynchrone là où une constante était gratuite. Ces lectures passent par une fonction du DAL en `'use cache'` avec un `cacheTag` par association, invalidé par `updateTag` à chaque modification pour que le bureau voie son changement immédiatement.

**À surveiller**

- **Ne pas mettre de secret dans `organization_setting`** : les clés d'API des intégrations (Pennylane, Brevo, ASL Community) sont des secrets, pas des réglages éditables en back-office. Elles vivent dans la configuration d'environnement validée par `@/env`, conformément à `rule-environment-variables.md`.
- Les valeurs par défaut du CDCT §4.6 (`contact@asl-exemple.test`, l'adresse du responsable forage) sont des **valeurs de seed du premier tenant**, jamais des constantes du code.
- Le helper de contrôle de module est un point de sécurité : s'il est oublié en tête d'une route, le module désactivé reste atteignable. Sa présence est un point d'arrêt de revue pour toute story d'un module activable.
