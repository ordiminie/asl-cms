# Review — Story s08-formulaire-contact

Revue n° 1 — diff `git diff main...feature/s08-formulaire-contact`, commit `19f3f5c` (63 fichiers).
Reviewer : subagent `reviewer`, contexte neuf.

## Exécuté par le reviewer

- `pnpm test --run` : 138 fichiers passés (2 ignorés), 1491 tests passés, 8 ignorés.
- `pnpm exec tsc --noEmit` : 0 erreur.
- `pnpm lint` : 0 erreur (2 avertissements hors story, `.remember/tmp` et `.scratch`).
- `pnpm check:rules` : règles et documentation alignées sur le code.
- e2e : non rejoués par le reviewer (build de prod + Postgres seedé requis) ; exécution locale
  rapportée 117/117 (un worker), CI à confirmer. `e2e/contact.spec.ts` relu : critères 1 à 4,
  isolation par la liste de l'autre tenant, RLS en SQL direct sous le rôle applicatif
  (portée B → 0 ligne, sans portée → 0 ligne), en-tête `x-forwarded-for` posé.

## Conformité au plan

- [x] Tâches 1 à 7 présentes (tokens `--destructive-text`, `--table-stripe`, `--table-row-hover`,
      `EMAIL_COLORS_DARK`, `emailDarkModeCss` ; modèle, migration 0020 générée, 0021 custom RLS
      activée + forcée, chaîne de snapshots 0019→0020→0021 cohérente ; `contact.message.read`
      accordé à owner et board ; repository, service, DAL, email, formulaire, back-office, e2e, docs).
- [x] Rien d'interdit touché (`user_submission*`, seed, `tenant-isolation.spec.ts`, limiteur s08b).
- [x] Écarts de fichiers justifiés par le plan (`site-alert-form.tsx` pour la tâche 1 ;
      `docs/stories.md` référencé par le plan).
- [x] Écart assumé : 25 cartes par page sur mobile (arbitrage de l'utilisatrice, consigné en tâche 6).

## Anti-hallucination

- [x] Chaque import et appel ouvert et vérifié à son chemin et sa signature (`getDb`, `withTenant`,
      `getOrganizationByIdDao`, `requireCurrentTenantDal`, `getCurrentTenantDal`,
      `associationOriginOf`, `resolveSupportedLocale`, `getAssociationSettingsService`,
      `getAccentHue`, `CONTACT_EMAIL_SETTING_KEY`, `getIdentityVersionFromKey`, `canPerformAction`,
      `createServiceInterceptor`, `requireActionAuth`, `refresh` de `next/cache`, `sendEmailService`,
      `getEmailAccent`, `EMAIL_COLORS` / `EMAIL_FONTS`, `NotFoundError`).
- [x] Validation de l'action et du service cohérentes.
- [ ] Plausible mais faux : mode sombre de l'email (M1).

## Règles

- [x] `getDb()` partout, accès métier sous `withTenant`, aucun nouveau `withRlsBypass`, aucune IP
      lue, adresse de notification en paramètre d'association (ADR 010), envoi par
      `sendEmailService`, intercepteur sans détail, locale explicite de bout en bout.
- [x] ADR 025 respecté (table dédiée, `organization_id NOT NULL` en cascade, pas de jsonb, pas de
      colonne d'adresse, `notification_failed` en colonne, `user_submissions` intact).
- [~] Design system : aucun composant ni token inventé ; deux écarts (M1, m1).

## Tests

- [x] Suite rejouée, verte.
- [x] Assertions sur les critères : validation sans écriture ni envoi ; échec de transport →
      `notification_failed` et soumission réussie ; destinataire lu dans les réglages, jamais
      `EMAIL_TO` ; `recipientType: 'system'` ; résumé d'erreurs focalisé avec ancres ; succès
      neutre ; contrôles de rôle sans appel DAO.
- [ ] Lacune : le test d'email vérifie seulement la présence du CSS sombre, pas l'affectation des
      classes (d'où M1).

## Régressions

- [x] `ui/table.tsx` : zébrure et survol sur toutes les tables (annoncé par le plan).
- [x] `ui/form.tsx` : renommage seul.
- [x] `/contact` reste `'use cache'`, sans donnée de requête ni horloge.
- [x] Clés `ContactPage` retirées non référencées ailleurs.

## Findings

**M1 — major (design system §5.2, design écran 4). Email de notification illisible en sombre.**
`src/lib/emails/contact-message-email.tsx:239-249` (boîte du message) et `:287-300` (pied).
Le `<td>` du message garde un fond clair en ligne (`#F6F7F8`) mais porte `email-dark-text` : en
`prefers-color-scheme: dark`, texte `#E8EBEF` sur `#F6F7F8` (≈ 1,1:1). Pied : texte `#9DA6AE` sur
`#F6F7F8` (≈ 2,3:1). Correctif : `EMAIL_DARK_CLASSES.background` sur le `<td>` et le pied (garder
`rule` sur la bordure), et un test qui vérifie que chaque élément à classe de texte sombre est sous
un ancêtre à fond sombre. Coût : faible.

**m1 — minor (§1.3). Tailles sous les planchers.** `contact-message-list.tsx:152` (adresse en
`text-sm`, 14 px < 15 px), `:88` et `:128` (`text-base`, 16 px < 17 px),
`contact-message-detail.tsx:86` (16 px au lieu de `body-strong` 17 px). Coût : faible.

**m2 — minor. Page au-delà de la fin → état vide mensonger.** `contact-message-list.tsx:48`.
Borner la page à `totalPages`, ou n'afficher l'état vide que si `total === 0`. Coût : faible.

**m3 — minor. Identifiant malformé → page d'erreur au lieu d'un 404.**
`src/app/dal/contact-message-dal.ts:42`. Traduire aussi `ValidationParsedZodError` en `undefined`,
ou valider l'UUID dans la page. Coût : faible.

**m4 — minor. Échec du marquage de l'échec → erreur affichée pour un message enregistré.**
`src/services/contact-message-service.ts:158-160`. Envelopper
`markContactMessageNotificationFailedDao` dans son propre try/catch qui journalise. Coût : faible.

**m5 — minor. Squelette de chargement sans en-tête de tableau.**
`src/app/[locale]/(bureau)/bureau/messages/page.tsx:69`. Rendre l'en-tête et 3 à 4 lignes
`skeleton` dans la `card`. Coût : faible.

**m6 — minor. Course entre marquage lu au montage et « Marquer comme non lu ».**
`src/components/features/contact/mark-read-on-open.tsx`. Attendre la promesse du marquage lu avant
l'action non lu, ou désactiver le bouton jusqu'à son règlement. Coût : faible.

**m7 — minor (processus). Docs de cadrage modifiés sur la branche** (`docs/stories.md`,
`docs/design-system.md` §5.4), à la demande du plan. À signaler dans la PR. Coût : nul.

**m8 — minor. Le DAL passe `tenant.id` au lieu de `withCurrentTenant`** comme écrit au plan ;
équivalent fonctionnel. À noter, pas de correctif. Coût : nul.

Reportés du plan validé, pas des findings : pas de limitation de débit sur `/contact` avant s08b
(décision F, s12b dépend de s08b) ; `FormMessage` corrigé à l'appel plutôt que dans `ui/form.tsx`.
Les deux sont à mentionner dans la PR.

---

# Revue n° 2 — après correctifs

Diff `git diff main...feature/s08-formulaire-contact`, commit `ab9597b` ; correctif relu comme du
code neuf (`git diff 19f3f5c ab9597b`, 16 fichiers, +395/−69).

## Exécuté par le reviewer

- `pnpm test --run` : 138 fichiers (2 ignorés), 1502 tests passés (8 ignorés), +11 depuis la revue n° 1.
- `tsc --noEmit` : 0 erreur. `pnpm lint` : 0 erreur. `pnpm check:rules` : aligné.
- e2e **non rejoués** après correctif (build de prod requis) : la CI doit les confirmer, en
  particulier lu → non lu (`e2e/contact.spec.ts:342-360`) et le nouveau squelette.

## Findings de la revue n° 1

- **M1** corrigé : `EMAIL_DARK_CLASSES.background` sur le `<td>` du message et la `Section` du pied ;
  test qui remonte au premier fond peint de chaque texte à classe sombre (échoue sur l'ancien code).
- **m1** corrigé : 17 px sur l'objet, les `<dl>` des cartes, l'expéditeur du détail ; 15 px sur
  l'adresse ; assertions de classes.
- **m2** corrigé : page bornée à `totalPages` dans `getContactMessagesPageService`, seconde lecture
  dans le même `withTenant`.
- **m3** corrigé : `ValidationParsedZodError` → `undefined` → 404 ; contrôle d'accès toujours avant
  la lecture.
- **m4** corrigé : `flagNotificationFailed` isolé dans son try/catch, soumission `created`.
- **m5** corrigé : `ContactMessageListSkeleton` avec l'en-tête réel (`MessagesTableHeader`).
- **m6** corrigé : `MarkReadOnOpen` enveloppe le détail, « non lu » attend le règlement du marquage
  lu ; ordre `['read','unread']` épinglé par deux tests ; marquage lu une seule fois (StrictMode).
- **m7**, **m8** : ouverts par choix, à signaler dans la PR avec les deux reports du plan.

## Nouveaux findings

**n1 — minor.** `src/components/features/contact/contact-message-detail.tsx:94` : lien `mailto:`
du bloc expéditeur en `text-base` (16 px), sous le plancher de 17 px du texte courant (§1.3 ; le
design le place dans le bloc expéditeur, pas en `meta`). Correctif : `text-[17px]` + assertion de
classe. Coût : faible.

**n2 — minor.** `src/lib/emails/contact-message-email.tsx:240` et `:288` : en sombre, la boîte du
message et le pied prennent le fond de la page (#171A1E). Lisibilité tenue ; le pied perd sa
séparation visuelle (la boîte garde sa bordure). `theme.ts` n'a pas de surface sombre « muted ».
Pas de correctif en s08 ; au besoin, teinte à ajouter au design system. Coût : moyen.

## Suite donnée

- **n1** corrigé après la revue n° 2 (commit `ebbf26b`) : `text-[17px]` sur le lien `mailto:`,
  assertion de classe ajoutée (échouait avant). Suite : 1503 tests passés, lint et tsc à 0 erreur.
- **n2** laissé ouvert : relève du design system (surface sombre « muted »), hors s08.

Max severity: minor
Ship allowed: yes
