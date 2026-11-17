---
validated: yes
---

# Plan — Story s54-adresses-email-multiples

Branch: `feature/s54-adresses-email-multiples`

Sources : `docs/research/s54-adresses-email-multiples.md`, `docs/designs/s54-adresses-email-multiples.md`
(+ `.html`), [ADR 056](../decisions/056-adresses-d-une-fiche-table-dediee-roles-et-confirmation.md)
(remplace l'ADR 040 et l'unicité de l'ADR 054 §1), [ADR 057](../decisions/057-envoi-a-chaque-adresse-active-et-desinscription-par-adresse-de-fiche.md)
(remplace l'ADR 055 sur la cible et la désinscription).

## Target story

Un membre a plusieurs adresses ; chacune se connecte et ouvre le même espace (critères 1-2) ; toutes les
adresses actives reçoivent les campagnes (3) ; le membre ajoute des adresses et modifie la sienne par lien de
confirmation, le bureau gère tout (4-5) ; non-régression des comptes existants (6) ; pas d'ajout par le membre
d'une adresse portée par une autre fiche (7) ; rôle titulaire / supplémentaire propre à chaque fiche (8) ;
succession de la titulaire (9) ; retrait ciblé (10) ; import de toutes les adresses (11) ; adresses et origine
dans la fiche du bureau (12).

**Arbitrages du 16/11/2026** : désinscription **par adresse** (ADR 057) ; un ajout par une personne à
plusieurs terrains vaut pour **tous** ses terrains, sa propre adresse modifiée aussi (ADR 056 §4).

**Décidé au plan** (ADR 056, 057) : table `member_profile_email` ; `member_profile.email` / `mail_only`
retirées ; lien `(fiche, compte)` à unicité `(member_profile_id, user_id)` ; jeton haché, confirmé par bouton ;
paramètre `member.email_confirmation_days` (seed 7) ; nature d'envoi `member_email_confirmation` ;
`campaign_recipient.email` ; `unsubscribed_at` sur l'adresse, `member_unsubscribe` repris puis retiré ;
`{nom}` / `{parcelle}` selon l'ADR 055 appliquée à l'adresse ; signalement et question copient l'adresse
**de la personne connectée** ; origine reprise = `file` si `pennylane_customer_id`, sinon `site` ; une adresse
en attente expirée est ignorée à la lecture, purgée à l'écriture suivante. Gaps du design tranchés : en
attente côté membre, une seule action « Gérer » (pas deux liens par ligne) ; 4e reste un `alert-dialog` à
`radio-group` (choix borné aux adresses de la fiche + une saisie) ; textes sans pronom.

## Tasks (ordered)

1. [x] **Modèle et migrations (ADR 056, 057)** — `src/db/models/member-profile-email-model.ts` (colonnes,
       contraintes et index de l'ADR 056 §1) dans `db.ts` ; `member-profile-account-model.ts` (unique
       `(member_profile_id, user_id)`) ; `campaign_recipient.email` + unique `(campaign_id, lower(email))`.
       Ordre : (a) `pnpm db:generate` (table, colonne nullable, index) ; (b) `drizzle-kit generate --custom` :
       RLS activée **et** forcée + policy `tenant_isolation` (patron `0055`), reprise des adresses
       (`INSERT … SELECT … FROM member_profile WHERE email IS NOT NULL`, `holder`/`active`, origine), de
       `member_unsubscribe` vers `unsubscribed_at`, de `campaign_recipient.email` depuis la fiche ; (c) retrait
       de `member_profile.email`, `mail_only`, de leur index, de `member_unsubscribe`, `NOT NULL` sur
       `campaign_recipient.email`, puis `pnpm db:generate`. `docs/architecture.md` : table ajoutée et `member_unsubscribe`
       retirée (le compteur reste à 47, la phrase de l'inventaire le dit), `member_profile` et lien décrits, « s38 devra la
       déclarer ». **Vérif** : `pnpm db:generate` sans diff ; migrations rejouées sur la base locale de secours
       (skill `postgres-local-dev`) depuis l'état `0056` avec une fiche + compte + désinscription créés avant :
       requête de contrôle montrant l'adresse `active`/`holder`, le lien intact et le refus repris (critère 6),
       sortie collée dans le rapport d'exécution.
2. [x] **Règles pures** — `src/services/rules/member-email-rules.ts` : succession de la titulaire (ajout sur
       fiche sans adresse active → titulaire ; désignation ; retrait de la titulaire avec remplaçante existante
       ou nouvelle ; refus sans remplaçante sauf dernière active → courrier ; modification de la titulaire →
       titre transmis ; création d'import : première titulaire ; fiche existante : ordre ignoré ; aucune
       promotion d'office) et droits du membre (sa propre adresse = `user.email` ; jamais l'adresse d'un tiers
       de la fiche ; corrige/annule seulement ses adresses en attente ; expiration). Type de domaine
       `member-email-types.ts`. **Vérif** : un test unitaire par cas du critère 9 et par refus du critère 4.
3. [x] **Repository des adresses + lecteurs** — `src/db/repositories/member-profile-email-repository.ts`
       (adresses d'une fiche avec origine/statut/auteur, actives par adresse dans l'association, insert / update
       / delete / désignation dans la transaction, purge des expirées, lecture par hash de jeton). Réécrire les
       lecteurs de l'ancienne colonne : `getMemberProfilePageDao` (titulaire + nombre d'autres adresses actives,
       `mailOnly`/`incomplete` par `NOT EXISTS`), `getMemberProfileByIdDao`, `getMemberProfilesByEmailDao`,
       `getUnlinkedMemberProfilesWithEmailDao` (devient : adresses actives sans lien), `isIncomplete`,
       `toMemberProfileDto`, `member-question-repository.ts`. Aucune jointure sur `member_profile_account` ne
       doit plus multiplier une fiche. **Vérif** : typecheck vert ; tests repository/règles mis à jour.
4. [x] **Compte par adresse** — `member-account-service.ts` : ouverture d'une adresse active (`user` de
       l'adresse + lien), fermeture ciblée `(fiche, compte)` (nouveau `unlinkMemberProfileAccountDao(profileId,
       userId)`), `replaceMemberAccount` pour une adresse modifiée ; `refuse_board_removal` évalué par adresse ;
       `openMemberAccountsForOrganization` sur les adresses actives sans lien. **Vérif** : tests : deux adresses
       → deux comptes reliés à la même fiche ; retrait d'une adresse → l'autre garde son lien, la ligne
       `member` de l'adresse retirée part seulement sans autre fiche (critère 10).
5. [x] **Services du bureau** — `member-profile-service.ts` (ou `member-profile-email-service.ts` + façade) :
       création (l'email saisi = titulaire), coordonnées sans email ; `addMemberProfileEmailService` (adresse
       portée ailleurs → `email_shared` + rôle choisi, confirmation revérifiée comme s53),
       `updateMemberProfileEmailService`, `removeMemberProfileEmailService` (remplaçante obligatoire),
       `designateHolderService`, toutes sous `MEMBER_PROFILE_MANAGE`, une transaction, règles de la tâche 2,
       tâche 4 pour les comptes, `authorOf` lu avant `withTenant`. DTO : adresses (rôle, statut, origine,
       auteur, échéance, autres fiches du compte, rôle au bureau) ; `isSelf` sur l'ensemble des comptes.
       **Vérif** : tests de service par rôle (bureau, membre refusé, invité) et par cas.
6. [x] **Écrans du bureau** — `member-profile-detail.tsx` : carte « Adresses email » (4a-4g : tableau / cartes
       sous 640 px, `dialog` ajout/gestion, `alert-dialog` de retrait, `radio-group`), carte « Accès » réduite ;
       `member-profile-form.tsx` (libellé titulaire) ; `member-profile-list.tsx` (« + {n} autres adresses ») ;
       actions `bureau/proprietaires/[id]/actions.ts` ; `messages/fr.json`. Composants du design system seulement.
       **Vérif** : tests de composants (états, focus, aucun identifiant superflu dans le DOM).
7. [x] **Campagnes et désinscription (ADR 057)** — `getCampaignTargetRowsDao` (une ligne par fiche × adresse
       active, désinscription de l'adresse), `computeCampaignTarget` (groupement inchangé sur la clé, décomptes
       en adresses), création des lignes avec `email`, `getPendingPartRecipientsDao` (adresse de la ligne,
       encore active ?), `addressValuesOf`, désinscription par jeton → `unsubscribed_at` sur toutes les adresses
       égales ; page `desinscription/[jeton]` et libellés (« cette adresse »). **Vérif** : tests de règles et de
       service : fiche à deux adresses = deux destinataires ; adresse partagée entre fiches = un ; proche
       désinscrit, titulaire servi ; adresse retirée entre création et livraison = rien n'est envoyé.
8. [x] **Import (s13)** — `pennylane-clients-mapper.ts` : toutes les adresses de la cellule (dédoublonnées sans
       casse), remarque `several_emails` retirée (type, libellés, rapport) ; `member-import-service.ts` : la
       première titulaire, les suivantes supplémentaires, origine `file`, actives ; adresse portée par une autre
       fiche : même compte (s53), rôle par la règle de la cellule. **Vérif** : tests du mapper et du service
       (cellule à trois adresses, adresse partagée titulaire ici / supplémentaire ailleurs — critère 8).
9. [x] **Confirmation par lien** — clé `member.email_confirmation_days` (registre `association-settings-types.ts`,
       section `sending`, `number`, seed 7) ; nature `member_email_confirmation` dans `TENANT_EMAIL_NATURES` ;
       modèle d'email (gabarit du lien magique, texte brut, jumelles sombres §5.2, constantes hex) dans
       `email-service.ts` ; page publique `src/app/[locale]/(public)/confirmer-adresse/[jeton]` (3a-3d) +
       Server Action de confirmation (tenant par le domaine, hash, expiration, revérification du critère 7,
       activation ou remplacement via tâches 2 et 4). **Vérif** : tests : jeton inconnu / expiré / annulé /
       réutilisé → même état 3c ; adresse prise entre-temps → 3d sans activation ; aucun envoi tant que
       `pending` ; le jeton en clair n'est jamais écrit en base.
10. [x] **Espace membre** — services (`member-space-service.ts` ou `my-email-service.ts` + façade) :
        `getMyEmailsService`, `addMyEmailService` (toutes mes fiches, refus du critère 7 sans nommer
        personne, envoi du lien), `updateMyEmailService` (en attente avec `replaces_email_id`, l'ancienne reste
        active), `correctMyPendingEmailService` / `cancelMyPendingEmailService` (auteur seulement). Carte « Mes
        adresses email » (1a-1f, chargement) dans `member-space.tsx`, paire « Email » retirée de
        `my-contact-card.tsx` ; DAL `member-space-dal.ts`. Signalement et question : `reporterEmail` /
        `memberEmail` = `authUser.email`. **Vérif** : tests d'autorisation **sur l'appel serveur direct**
        (critère 4) : une supplémentaire modifie la titulaire → refusé ; la titulaire modifie une supplémentaire
        → refusé ; annuler l'attente d'un autre → refusé ; identifiant d'une fiche/adresse d'une autre
        association → refusé.
11. [x] **Seed, e2e, docs** — `seed.ts` : fiche à deux adresses actives (titulaire + supplémentaire) dans
        l'association A, une adresse titulaire d'une fiche et supplémentaire d'une autre. e2e : les deux
        adresses se connectent (lien magique, transport mémoire/fichier) et voient le même espace (critère 2) ;
        ajout par le membre → lien → confirmation → connexion (critères 4-5) ; retrait par le bureau → accès
        fermé à la requête suivante, autres fiches ouvertes (10) ; adresse partagée sur deux rôles (8) ;
        isolation de `member_profile_email` entre deux associations (`tenant-isolation.spec.ts`) ; mise à jour
        de `member-accounts`, `member-profiles`, `member-import`, `campaigns`. Docs : `docs/design-system.md`
        (§5.5 huitième envoi, §7 page à bouton, §9 ligne rouverte), `docs/exploitation/README.md` si le
        paramètre y est listé. **Vérif** : `pnpm lint`, typecheck, `pnpm test --run` verts (copie disque local
        si 9p) ; e2e en CI GitHub (jamais en local).

## Files touched

- Modèles : `member-profile-email-model.ts` (nouveau), `member-profile-model.ts`, `member-profile-account-model.ts`,
  `campaign-model.ts`, `db.ts` ; `drizzle/migrations/0057…` à `0059…` + meta (générés).
- Repositories : `member-profile-email-repository.ts` (nouveau), `member-profile-repository.ts`,
  `campaign-repository.ts`, `member-unsubscribe-repository.ts` (retiré ou réduit), `member-question-repository.ts`.
- Services : `rules/member-email-rules.ts` (nouveau), `rules/member-account-rules.ts`, `rules/campaign-rules.ts`,
  `rules/parcel-ownership-rules.ts`, `rules/member-profile-rules.ts`, `member-account-service.ts`,
  `member-profile-service.ts`, `member-space-service.ts`, `campaign-service.ts`, `member-import-service.ts`,
  `member-question-service.ts`, `incident-report-service.ts`, `email-service.ts`, façades et validation
  correspondantes, `types/domain/*` (`member-email-types.ts` nouveau, `email-send-types.ts`,
  `association-settings-types.ts`, `member-import-types.ts`, `member-profile-types.ts`, `member-space-types.ts`).
- Import : `src/lib/import/pennylane-clients-mapper.ts`.
- Présentation : `member-profile-detail.tsx`, `member-profile-form.tsx`, `member-profile-list.tsx`,
  `member-space.tsx`, `my-contact-card.tsx`, carte « Mes adresses email » (nouvelle), page
  `(public)/confirmer-adresse/[jeton]` (nouvelle), `desinscription/[jeton]`, actions bureau et membre,
  `member-space-dal.ts`, `messages/fr.json`.
- Seed et e2e : `src/db/scripts/seed.ts`, `e2e/*.spec.ts` cités.
- Docs : ADR 056, 057, `docs/architecture.md`, `docs/design-system.md`, recherche, design, plan.

## Test strategy

- **Unitaires (Vitest, `--run`)** : règles pures (succession, droits du membre, cible de campagne) en premier, cas
  par cas des critères 4, 8, 9 ; services par rôle avec DAO mockés (bureau, membre, invité, SuperAdmin) ; mapper
  d'import ; composants (états du design, accessibilité §3.8).
- **Autorisation** : appels directs aux services/actions du membre avec des entrées forgées (critère 4).
- **e2e (Playwright, CI)** : connexion des deux adresses (2), parcours de confirmation (4-5), retrait (10), rôle par
  fiche (8), isolation RLS de la nouvelle table entre deux associations.
- **Migration** : rejeu local des migrations sur un état `0056` peuplé (critère 6), résultat consigné.

## Definition of Done

- Une PR, une branche `feature/s54-adresses-email-multiples`, un commit de story (+ un commit à part pour les
  migrations si utile au retour arrière).
- Les douze critères couverts par un test nommé ; non-régression des comptes et campagnes existants prouvée.
- RLS forcée sur `member_profile_email`, test d'accès croisé e2e.
- Aucune valeur en dur (délai d'expiration en paramètre, textes dans `messages/fr.json`).
- `/ks-review` passée sans critique ; e2e verts en CI.
- Rappel au déploiement : les migrations retirent `member_profile.email` — sauvegarde s12c avant `db:migrate`.

## Fix round 1 (review of 16/11 — docs/reviews/s54-adresses-email-multiples.md)

- [x] **C1** — at confirmation, skip (and refuse when nothing remains) the pending rows of profiles their author
  (`added_by_user_id`, when not null) is no longer linked to; when an account is unlinked from a profile (address
  removed, replaced, account closed), delete the pending rows that account authored on that profile. Service
  tests for both paths.
- [x] **M1** — the clear token is never written to the database, deferred emails included: a deferred
  confirmation email does not store a usable link; at replay, a fresh token is generated, its hash replaces the
  pending rows' hash and the expiry counts from the actual send. Tests: deferred body carries no token; replay
  rotates the hash.
- [x] **M2** — `groupPendingSends` uses each deferred email's stored nature; label for
  `member_email_confirmation` in `messages/fr.json`. Test.
- [x] **m3** — changing an active address's value clears `unsubscribed_at` (ADR 057: a new address does not
  inherit a refusal). Test.
- [x] **m4** — `correctMyPendingEmailService` purges expired pending rows before writing. Test.
- [x] **m1** — seed `member.email_confirmation_days = 7` for the first tenant (ADR 056 §5).
- Left as is, recorded in the review: m2 (pre-s53 duplicates only, nothing sent), m5 (throttle — budget reserve
  protects login), m6 (idempotent).

## Fix round 2 (review of 16/11, round 2 — arbitration of 17/11: fix before shipping)

- [x] **MA1** — remove the public `revoked` state: a link whose author is no longer linked shows the single
  neutral message of screen 3c (`invalid`, « Ce lien ne sert plus »), on load and on confirm; drop the
  `revokedTitle` / `revoked` keys. Tests updated.
- [x] **mi1** — a deferred link is identified by its token hash (not secret), not by one pending row: at replay,
  rotate over the link's remaining pending rows; drop the email only when none remains. Tests.
- [x] **mi3** — when a member replaces their own address, the pending rows they authored are re-attributed to
  the new account instead of being deleted (deletion stays for unlink and close). Tests.
- [x] **mi4** — an author-less pending row is not activable (fail-closed). Update the test that pinned the
  fail-open.
- Left as is: mi2 (rare, second email works), mi5 (low probability), m2, m5, m6.

## Fix round 3 (review round 3 — arbitration of 17/11: revert mi3)

- [x] **C1-bis** — revert mi3: on every replacement (bureau edit, `link_shared`, member's own confirmation), the
  pending rows the old account authored on that profile are **deleted**, as before cf14e6f3; remove
  `reassignPendingEmailsAddedByDao` if unused. A member who replaces their own address re-adds their pending
  additions (accepted by the arbitration). Tests: bureau edits the author's address → the link returns 3c and
  nothing activates; replacement deletes, never reassigns.
- [x] **MA2** — when a deferred link is rotated, `deferred_email.confirmation_token_hash` follows the new hash
  (same `withTenant`), so a provider refusal followed by a retry still finds the link's rows. Test "refusal then
  retry" with a mock filtering by hash.
- [x] **mi-a** — document `deferred_email.confirmation_token_hash` in `docs/architecture.md` (the
  `deferred_email` row).
- [x] **mi-b** — `markDeferredEmailToVerifyTxnDao` clears `confirmation_token_hash` (consistency).
