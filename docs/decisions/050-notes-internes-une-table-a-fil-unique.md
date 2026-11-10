# ADR 050 — Les notes internes d'un membre tiennent dans une table à fil unique, supprimée physiquement

- Status: accepted
- Date: 2026-11-09
- Scope: story s24-notes-internes-membre

## Context

s24 consigne, sur la fiche d'un membre, des **notes** et des **échanges** (téléphone, courrier, en personne,
email), lus dans un fil chronologique unique, réservés au bureau (critère 4). Rien n'existe : ni table, ni
écran. Quatre choix engagent la suite et la recherche les a laissés ouverts : la forme du stockage, la clé
étrangère vers la fiche (aucune suppression de fiche n'existe encore, et l'effacement RGPD reste « en
attente », `docs/architecture.md`), la suppression, et ce que « auteur et date de dernière modification »
veut dire (critère 5).

## Decision

- **Une table `member_note`** (RLS forcée, ADR 002) portant `kind` (`note` | `exchange`) et `channel`
  (`phone` | `mail` | `in_person` | `email`), contrainte `CHECK` : le canal est renseigné **si et seulement
  si** l'entrée est un échange. Le fil est une seule requête, paginée côté base.
- **Clé de tri `entry_date`** (jour calendaire de Paris, `date` en `mode: 'string'`) : le jour **choisi**
  pour un échange, le jour de saisie (`calendarDayOf(created_at)`, calculé par le service) pour une note.
  Ordre : `entry_date desc, created_at desc, id desc` (départage stable). `created_at` reste l'instant de
  saisie, affiché avec l'heure sur une note.
- **`member_profile_id` → `member_profile.id`, `ON DELETE RESTRICT`** : comme `incident_report.member_id`
  (ADR 049). Une note n'a pas de sens sans sa fiche ; `SET NULL` laisserait des notes orphelines et
  anonymes sur des personnes physiques.
- **Auteur par copie** : `author_user_id` (`SET NULL`) + `author_name`, `on_behalf_of_*` pendant une imitation
  (s48), écrits par `effectiveAuthor` lu **avant** `withTenant`. L'auteur d'origine ne change jamais.
- **Modification : `updated_at` seul**, nul tant que l'entrée n'a pas été modifiée. La mention est
  « Modifiée le … à … », sans nom : la lecture littérale du critère 5.
- **Suppression physique.** Aucune trace ni corbeille.
- **Même traitement pour une note et un échange** (modifiables, supprimables). Le **type est immuable** : la
  modification est scopée par `kind`, on ne transforme pas une note en échange.
- **Action d'autorisation propre `member.note.manage`**, `defaultRoles: ['owner', 'board']`, à part de
  `member.profile.manage` (précédent `member.role.assign`) : une note est plus sensible qu'une coordonnée et
  s37 pourra la régler seule. Un compte du bureau lit les notes qui le concernent lui-même (le périmètre est
  la fonction, pas la personne) ; un `member` n'a aucun accès.
- **Canaux : liste fermée de code** (comme `ReportStatus`), libellés dans `messages/fr.json`. Plafond du
  texte (2 000) et taille de page (10) : constantes nommées de code.

## Considered options

- **Deux tables (`member_note`, `member_exchange`)** — rejeté : le fil unique deviendrait une union de deux
  requêtes à paginer et à départager ; le `CHECK` sur `kind`/`channel` suffit.
- **Tri par `created_at` seul** — rejeté : un échange dont le jour est choisi (« appelé le 12 mars ») doit
  se classer à ce jour, pas à celui de la saisie.
- **`ON DELETE CASCADE`** — rejeté : supprimer une fiche effacerait en silence le suivi du bureau.
- **`SET NULL` + nom copié** (précédent `member_role_event`) — rejeté : une note orpheline n'est
  exploitable par personne et reste une donnée personnelle sans objet. À rouvrir par un ADR qui supplante
  celui-ci le jour où une suppression de fiche, ou une purge RGPD, existe.
- **`updated_by_*` ou table de versions** — rejeté pour la V1 : le critère ne demande que l'auteur et la
  date. Ajouter `updated_by_*` plus tard est une migration additive.
- **Suppression logique** — rejeté : aucune exigence de trace, et elle garderait des données personnelles
  que le bureau a voulu effacer.
- **Réutiliser `member.profile.manage`** — rejeté, voir plus haut.

## Consequences

- Une table, deux migrations : `pnpm db:generate` pour le schéma, `drizzle-kit generate --custom` pour la
  RLS (calquée sur `0036_member_role_event_rls.sql`).
- Supprimer une fiche portant des notes sera refusé tant que cette décision tient.
- **s38 et s39 doivent déclarer `member_note`** dans l'export d'association et dans le contrôle de
  complétude, et **s40** l'inclure dans la copie du membre (critère 4 de s24 : « relève de s40 »). s24 ne
  livre aucun des trois.
- Un texte libre sur des personnes physiques : borné côté Zod **et** côté service, rendu en texte, **jamais
  dans les journaux** (intercepteur sans détails).
- Hors de cette décision : pas d'alimentation automatique du fil par les signalements, questions ou
  campagnes (extension écartée par la story).
