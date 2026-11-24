# Revue — Story s42b-lancement-invitations

Tour 1 — commit `622c2139`, diff `git diff main...feature/s42b-lancement-invitations` (79 fichiers). Revue
en contexte neuf (subagent `reviewer`), en lecture seule.

Aucun constat critical ni major. Huit mineurs, à traiter au tour final des mineurs. Ship conditionné au
job e2e vert en CI sur la PR (non exécuté en local, conformément aux consignes du dépôt).

## Résultats des tests

Copie en disque local vérifiée identique au commit (`diff -rq` vide sur `src`, `e2e`, `messages`,
`drizzle` ; `cmp` identique sur `package.json`, `vitest.config.ts`, `tsconfig.json`, `pnpm-lock.yaml`).

- `pnpm test --run` : `Test Files 462 passed (462)`, `Tests 6333 passed | 4 skipped (6337)`, 273,67 s,
  sortie 0. Aucun timeout, aucun FAIL.
- `pnpm exec tsc --noEmit` : sortie 0, aucune erreur (rien de masqué par `.next/types`).
- `eslint` sur les `.ts`/`.tsx` ajoutés ou modifiés : sortie 0.
- e2e : non exécuté. C10, l'isolation et C2/C3/C5/C6/C8 de bout en bout ne sont prouvés qu'une fois le job
  e2e vert sur la PR.

## Ce qui a été vérifié

**APIs réellement existantes** (cibles ouvertes, nom, signature, emplacement) : `issueInvitationLink` /
`revokeInvitationLink` (`src/lib/better-auth/invitation-link.ts` ; `null` sans domaine ou hors
association ; `deleteVerificationByIdentifier`), `claimRecipientForSendTxnDao`,
`releaseRecipientClaimTxnDao`, `createCampaignWithRecipientsTxnDao` (`...input.content` étalé dans
`.values(input)` : `letterText` persisté), `getInvitationStatesByUserIdsDao`, `markInvitedTxnDao`,
`getCurrentParcelNumbersForMembersDao`, `claimDeferredEmailForSendTxnDao … .returning()` (rend
`createdAt`), `createTranslator`, `uuid v5`, `runImmediateCampaignPass`, composants `alert-dialog`,
`breadcrumb`, `table`, `badge`, `skeleton`. Aucune référence inventée.

**Ordre prise → émission → composition → envoi** (`campaign-service.ts`, `deliverInvitationToRecipient`) :
conforme à l'ADR 072 §3. Prise perdue → `done` sans émission. Révocation et libération sur `deferred`,
`skipped`, refus certain, échec de composition ; `to_verify` ne révoque pas. « Invitée le » au seul `sent`,
dans le même `withTenant` que `markRecipientSentTxnDao`. Épinglé par `invocationCallOrder`
(`member-invitation-delivery.test.ts`).

**Écart « `issueInvitationLink` lève »** : ligne libérée, `failedAttemptOutcome`, borné par
`sendMaxAttempts` ; rien ne bloque indéfiniment, aucun jeton rendu.

**Écart « révocation en échec »** : jeton vivant mais jamais transmis, journalisé ni stocké ; il meurt à
l'émission suivante pour l'adresse ou à échéance (m3).

**Aucun lien ni jeton conservé** : la campagne ne passe pas par `deferred_email` (`isDeferredByCaller`) ;
`logFailure` / `revokeAndRelease` ne journalisent que `error.name` ; intercepteur
`shouldLogDetails: () => false` ; `body_markdown` ne porte que le texte, `campaign_recipient` aucun lien ;
test : aucune URL ni jeton dans les appels du logger ni dans les arguments des DAO.

**Texte jamais interprété** : `invitationParagraphsOf` + nœuds texte React (`whiteSpace: pre-line`), ni
`renderCampaignBodyHtml` ni `substituteVariables` ; version texte idem ; détail de campagne par
`invitationParagraphsOf` ; PDF par `letterTextBlocksOf`. `**gras**`, `<b>`, `{nom}`, `[x](…)` ressortent
littéralement (tests). Objet préfixé une seule fois par `finalSubject`.

**C2, jugement rédactionnel** : le texte par défaut du courrier
(`CampaignsBureau.letters.pdf.memberInvitation.defaultText`) annonce le site consultable sans inscription,
les actualités et les analyses d'eau (pages livrées), et rappelle que le bureau continue d'écrire par la
poste. Aucun lien, aucune promesse d'accès, aucune fonctionnalité non livrée. Le PDF imprime
`letter_text`, jamais `bodyMarkdown` ; test : ni `/login` ni « Ouvrir mon espace ».

**C5, C6, C7, C8** (`member-invitation-campaign-rules.ts`) : cible sur les seules adresses `active` ;
dédoublonnage par adresse du moteur s53 ; couverture en fiches par `campaignChannelsOf` ; une adresse
partagée = un seul état ; attentes échues masquées ; relance = adresses actives jamais connectées, sans
compte comprises, jamais une ligne sans adresse ; `superseded` revérifié à la livraison. Tous les cas de
la story testés.

**C3** : `statutaire` → le désinscrit est servi ; `facultative` → `unsubscribed` sans lien émis. e2e sur
les deux associations.

**C9** : la part glisse par `deferPartOutcome`, jeton du report révoqué (test).

**C10** : e2e par le vrai planificateur (`pnpm tsx src/db/scripts/run-scheduled-jobs.ts`) sur `localhost`
et `127.0.0.1` ; part > 1, origine du lien, session ouverte, `first_signed_in_at`. Pas encore exécuté.

**Correctif m5 de s42a** (`email-service.ts`, `invitedSince`) : `last_invited_at > deferred_email.created_at`
→ `gone`, budget remboursé (`refundReportableSendTxnDao`), ligne supprimée ; le report seul ne déclenche
pas le saut. Deux tests.

**Autorisation et tenant** : `campaign.manage` par `canPerformAction` dans chaque service ;
`canManageCurrentCampaignsDal` puis `BureauAccessDenied` dans la page ; `requireCurrentTenantDal` et
`requireActionAuth` dans les actions ; DAO par `getDb()` sous `withTenant` ; `user` (sans RLS) lue
seulement par jointure sur l'email ; aucun `withRlsBypass` dans le diff.

**Migration `0081_reflective_sabra.sql`** : `ADD VALUE 'superseded'` et `ADD COLUMN letter_text`, rien
d'autre ; journal idx 81, `prevId` = id de 0080, enum et colonne dans le snapshot. Aucune table nouvelle.

**`docs/architecture.md`** (tableau réaligné par Prettier) : comparé en normalisant les espaces, seuls deux
contenus changent, voulus (ligne `campaign_recipient` avec `settled`, `superseded`, `letter_text` ; phrase
de l'ex-ligne 615 sur les liens rebasés sur l'association).

**`docs/design-system.md`** : §5.6 (préfixe posé une fois), §6.1 aligné, gaps du design versés au §9.

**Nature d'un tenant non seedé** : `facultative`, défaut du registre — même patron que `unpaid_reminder`,
`reminder`, etc. ; seed du premier tenant sur TechCorp ; conforme à l'ADR 010 (m6 pour la production).

## Constats

Aucun critical, aucun major.

**m1 — Le lancement écarte aussi les adresses connectées avant sa création**

- `src/services/rules/member-invitation-campaign-rules.ts:91-104` (`invitationSkipOf`), appelé par
  `deliverInvitationToRecipient`.
- `firstSignedInAt` non nul suffit à rendre `superseded`, quelle qu'en soit la date ; le plan (Q4) parle
  d'une adresse « connectée depuis la création ». Une adresse connectée par une invitation s42a avant le
  lancement est comptée dans « N adresses » (écran 1a, dialogue) mais ne reçoit rien (« Écartée à
  l'envoi »). Défendable, mais non écrit pour le lancement.
- Correctif : l'écrire dans l'ADR 072 §5 et dans la phrase du dialogue, ou comparer
  `firstSignedInAt > campaignCreatedAt` si l'intention est « depuis la création ».

**m2 — L'ADR 072 §4 ne décrit pas l'issue « le générateur lève »**

- `campaign-service.ts`, `catch` autour de `issueInvitationLink` : la part s'arrête avec une tentative
  comptée ; l'ADR dit « seul un échec de composition ou de transport arrête la part ».
- Correctif : compléter l'ADR (non encore fusionnée).

**m3 — Un jeton non envoyé peut survivre quand la révocation échoue**

- `campaign-service.ts`, `revokeAndRelease`. Valide jusqu'à échéance si l'adresse n'est plus invitée ;
  détenu par personne. Même parti que s42a (`revokeUnsentInvitationLink`).
- Correctif : aucun ce cycle ; le noter dans l'ADR comme risque résiduel.

**m4 — « valable N jours » du détail de campagne lit le réglage actuel**

- `src/app/[locale]/(bureau)/bureau/campagnes/[id]/page.tsx`, `campaign-detail.tsx` (`invitationAdded`).
- Si la durée change après l'envoi, l'archive affiche une durée qui n'était pas celle des liens partis.
- Correctif : figer la durée sur la campagne, ou reformuler sans le nombre de jours.

**m5 — Écrans et dérive de plan déclarés**

- État 1c simplifié (« Lancement parti. » sans le détail jour par jour du design) ; ajouts hors plan
  `getCampaignsByTemplateIdsDao` et statut `nobody` (nécessaires, testés) ; TDD pas toujours tenu (tâche 4,
  composants de la tâche 9 jamais vus rouges) — écart de processus, les tests existent et passent.
- Correctif : réaligner 1c sur le design ou noter la simplification dans le design de la story.

**m6 — En production, les deux natures valent `facultative` tant qu'elles ne sont pas réglées**

- `src/db/scripts/tenant-settings-seed.ts` (TechCorp seulement). Conforme au patron et à l'ADR 010, mais
  tant que La Fourche n'a pas ses natures, la relance n'atteint pas les désinscrits et les fiches
  entièrement désinscrites ne reçoivent ni email ni courrier au lancement.
- Correctif : ajouter aux points de mise en production (régler les deux natures avant le lancement) et au
  rappel de déploiement de la PR.

**m7 — Preuve d'isolation e2e faible**

- `e2e/member-invitation-launch.spec.ts:594-625` : la session du bureau de A, posée sur `localhost`, est
  rejouée sur `127.0.0.1` ; le cookie n'est pas envoyé, le test prouve surtout le cloisonnement des cookies.
  Le refus sur un `organizationId` étranger est couvert en unitaire.
- Correctif : acceptable ; preuve plus forte avec un compte membre des deux associations, empêchée par m4
  de s42a — au deuxième client.

**m8 — Nettoyage e2e incomplet**

- `e2e/member-invitation-launch.spec.ts`, `cleanUp` : le lancement écrit `last_invited_at` pour les comptes
  du seed de TechCorp et Marketing Pro ; seules les traces `%-RUN@example.test` sont supprimées. Aucune spec
  actuelle n'en dépend. Helpers `e2e/support/` sans migration des specs existantes (acceptable).
- Correctif : supprimer aussi les traces écrites par la campagne nettoyée, ou restaurer celles du seed.

Note hors constat : les comptes connectés avant s42a n'ont aucune trace ; ils seront comptés « jamais
connectés » et relancés. Inscrit dans la DoD du plan (prévenir le bureau).

Max severity: minor
Ship allowed: yes
