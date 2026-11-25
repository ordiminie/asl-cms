# Revue — Story s42b-lancement-invitations

Tour 2 — HEAD `e2f2d79b`, diff `git diff main...feature/s42b-lancement-invitations`. Revue en contexte
neuf (subagent `reviewer`), en lecture seule. Le commit de correctif est relu comme du code neuf.

Aucun constat critical ni major. Le correctif `e2f2d79b` est juste et n'affaiblit aucun test. Ship
conditionné au job e2e vert en CI sur la PR 85 après le push du correctif.

## Historique

**Tour 1** (commit `622c2139`) : `minor` / `yes` sous réserve du job e2e vert ; huit mineurs m1–m8, aucun
correctif demandé.

**CI de la PR 85** (run 45472355325) : 2 échecs, 9 tests non exécutés, 335 passés.

- `e2e/campaigns.spec.ts:1601` (s27b, critère 5) : la page de désinscription liste 6 envois statutaires au
  lieu de 4 (« Lancement du site », « Relance des invitations » en plus). Comportement voulu par s42b ;
  spec périmée.
- `e2e/member-invitation-launch.spec.ts:445` : attente jusqu'au timeout (360 s) du radio « Titulaire de
  cette fiche », absent sur une fiche sans adresse.
- Non exécutés (describes en `serial`) : les 6 tests restants de `member-invitation-launch.spec.ts` et 3
  tests de `campaigns.spec.ts` (critère 6 de s27b, deux tests s30).

**Correctif `e2f2d79b`** (specs seulement) :

- `campaigns.spec.ts:1606-1607` : ajout des deux libellés en fin de liste. Ordre réel :
  `getStatutoryTemplateIds` (`association-settings-types.ts:1314`) filtre `CAMPAIGN_SEND_KINDS`
  (`campaign-types.ts:33-38`) — composeur, `unpaid_reminder`, `member_invitation_launch`,
  `member_invitation_reminder` ; seed statutaire `tenant-settings-seed.ts:98-104` ; libellés
  `messages/fr.json:2333-2334`, 4560-4561. `toHaveText([...])` reste exact et ordonné.
- `member-invitation-launch.spec.ts:446-448` : `{role: 'additional'}` au lieu de `'holder'`. Le
  `RadioGroup` n'existe que si `currentHolderEmail` est non nul (`member-profile-email-dialogs.tsx:342`) ;
  le helper attend toujours l'encart de partage puis confirme ; `roleForNewActiveEmail`
  (`member-email-rules.ts:63-77`) rend `holder` à la première adresse active. C6 reste vérifié l. 492 et 506.
- `neverSignedInText` (l. 347-349) : la pagination n'est lue que si `count() > 0` ; `AddressesPagination`
  n'est rendue que si `totalPages > 1` (`member-invitations-overview.tsx:328`). Lu après la carte, même
  frontière de rendu : pas de course, pas de masquage ; assertions de C7 inchangées.
- `pdfTextOf` (l. 361-365) : fragments vides ignorés, comme `render-letters-pdf.test.ts:46-47` ; assertions
  négatives (`/login`, `magic-link`, « Ouvrir mon espace ») intactes.

## Relecture indépendante des 9 tests jamais exécutés

- **Libellés et rôles** retrouvés dans `messages/fr.json` (l. 5005-5131) et les composants : h2
  « Lancement », « Relancer les jamais connectés », « Adresses jamais connectées » (aucune collision) ;
  « Lancer les invitations » ; `alertdialog` avec `planMany` (rendu dès plus d'une part, garanti par le
  plafond à 2), « Envoyer le lancement », « Envoyer la relance » ; « Lancement parti. » / « Relance
  partie. » dans le seul `role="status"` de la carte ; « Lancement — {date} », « Même adresse sur {count}
  fiches : un seul état », « Adresse du site : {domain} », « Invitations des membres » ;
  `data-slot="card"` (`card.tsx:8`) ; `LaunchCard` garde son état après `router.refresh()` ; pagination
  `?page=`.
- **SQL contre les modèles Drizzle** : `member_profile`, `member_profile_email` (enums `holder`/`active`/
  `site`), `organization_setting` (clé `(organization_id, key)`, `on conflict` valide),
  `email_send_budget`, `scheduled_job` (`payload.campaignId`, `campaign-service.ts:818`), `campaign_part`,
  `campaign_recipient`, `member_invitation_state`, `rate_limit_event` : colonnes réelles. Nettoyage en
  cascade, aucune FK `restrict` touchée.
- **Enchaînements** : campagne créée en `sending` ; à l'envoi seul le budget reportable compte (remis à 0
  dans `beforeAll`) ; fiches de remplissage sans compte → `markClaimedRecipientFailed` sans échec de part ;
  adresse ajoutée par le bureau → compte ouvert, atteinte par la relance ; rejeu Q7 par `page.request` ;
  isolation testée avant `launchOn('b')`.
- **C10 hors requête** : `associationOriginOf` ne lit aucun en-tête ; `nextCookies`
  (`better-auth/dist/integrations/next-js.mjs:72-95`) sans effet hors requête ; la branche invitation ne
  consomme pas de quota. Première émission de lien par le sous-processus du planificateur vérifiée en e2e :
  seule la CI le prouvera.
- **Autres specs** : barre du bureau, réglages et natures (critère 6 de s27b), détail de campagne (s30),
  `member-invitations.spec.ts` (s42a) : aucune cause d'échec trouvée.

## Vérifications

- `git diff --stat 989cc075 e2f2d79b` : seulement `e2e/campaigns.spec.ts` (+2) et
  `e2e/member-invitation-launch.spec.ts` (+9/−6) ; `git diff 622c2139 HEAD -- src messages drizzle
  package.json` vide. Suite unitaire du tour 1 toujours valable, non relancée : `Test Files 462 passed
  (462)`, `Tests 6333 passed | 4 skipped (6337)`.
- Copie en disque local resynchronisée (`diff -rq` vide sur `src`, `e2e`, `messages`, `drizzle` ; `cmp`
  identique sur `package.json`, `tsconfig.json`, `pnpm-lock.yaml`, `eslint.config.mjs`, `vitest.config.ts`).
- `pnpm exec tsc --noEmit` : sortie 0.
- `eslint` sur les deux specs et `e2e/support/{database,outbox,scheduler}.ts` : sortie 0 ; `prettier
  --check` conforme.
- Ni e2e ni build en local.

## Constats

Aucun critical, aucun major.

### Mineurs du tour 1, toujours ouverts (aucun correctif demandé)

**m1 — Le lancement écarte aussi les adresses connectées avant sa création**

- `src/services/rules/member-invitation-campaign-rules.ts:90-103` (`invitationSkipOf`) : `firstSignedInAt`
  non nul suffit à `superseded`, quelle qu'en soit la date ; le plan (Q4) parle de « connectée depuis la
  création ». L'adresse est comptée dans « N adresses » (écran 1a, dialogue) mais ne reçoit rien.
- Correctif : écrire le choix dans l'ADR 072 §5 et la phrase du dialogue, ou comparer
  `firstSignedInAt > campaignCreatedAt`.

**m2 — L'ADR 072 §4 ne décrit pas l'issue « le générateur lève »**

- `campaign-service.ts`, `catch` autour de `issueInvitationLink` : la part s'arrête, une tentative comptée.
- Correctif : compléter l'ADR.

**m3 — Un jeton non envoyé peut survivre quand la révocation échoue**

- `campaign-service.ts`, `revokeAndRelease` ; détenu par personne, même parti que s42a.
- Correctif : noter le risque résiduel dans l'ADR.

**m4 — « valable N jours » du détail de campagne lit le réglage actuel**

- `bureau/campagnes/[id]/page.tsx`, `campaign-detail.tsx` (`invitationAdded`).
- Correctif : figer la durée sur la campagne, ou reformuler sans le nombre de jours.

**m5 — Écrans et dérive de plan déclarés**

- État 1c simplifié ; ajouts hors plan `getCampaignsByTemplateIdsDao`, statut `nobody` (nécessaires,
  testés) ; TDD pas toujours tenu (tâche 4, composants de la tâche 9).
- Correctif : réaligner 1c ou noter la simplification dans le design.

**m6 — En production, les deux natures valent `facultative` tant qu'elles ne sont pas réglées**

- `tenant-settings-seed.ts` (TechCorp seulement), conforme à l'ADR 010.
- Correctif : point de mise en production (régler les deux natures avant le lancement) et rappel dans la PR.

**m7 — Preuve d'isolation e2e faible**

- `e2e/member-invitation-launch.spec.ts:594-625` : prouve surtout le cloisonnement des cookies ; refus sur
  un `organizationId` étranger couvert en unitaire. Acceptable ; au deuxième client.

**m8 — Nettoyage e2e incomplet**

- `cleanUp` ne supprime que les traces `%-RUN@example.test` ; `last_invited_at` écrit sur les comptes du
  seed reste. Aucune spec actuelle n'en dépend.

### Nouveaux

**m9 — `shared.role` mêle confirmation de partage et choix du rôle**

- `e2e/member-invitation-launch.spec.ts:448`, `e2e/support/member-email-card.ts:41-57` : `{role:
  'additional'}` alors que l'adresse devient titulaire ; aucune assertion ne lit le rôle obtenu (couvert en
  unitaire).
- Correctif : `shared?: {role?: …}`, ou vérifier « Titulaire » sur la ligne de l'adresse.

**m10 — Fragilité de budget et de résidus en nouvelle tentative CI**

- Lancement puis relance ≈ 2N emails reportables chez TechCorp pour une marge de 200 ; à une nouvelle
  tentative, `RUN` est régénéré et `cleanUp` (filtré par `RUN`) laisse les fiches de la tentative
  précédente, qui redeviennent destinataires. Si N approche 100, une part est reportée à chaque passage et
  `deliverAll` échoue après 20 passages (l. 290). Non observé.
- Correctif : nettoyer par motif (`s42b-%`), ou remettre `reportable_count` à 0 avant la relance.

**m11 — JSDoc périmée**

- `association-settings-types.ts:1310-1313` : « puis la relance automatique (s29) » ne cite pas les deux
  types de s42b.

**m12 — Correctif à pousser**

- La PR 85 affiche encore `Tests e2e (build de production) fail` ; les 9 tests listés ci-dessus seront
  exécutés pour la première fois au prochain job.

Note hors constat : les comptes connectés avant s42a n'ont aucune trace ; ils seront comptés « jamais
connectés » et relancés (DoD du plan : prévenir le bureau).

Max severity: minor
Ship allowed: yes
