---
validated: yes
---

# Plan — Story s08b-limitation-debit-formulaires

Branch: `feature/s08b-limitation-debit-formulaires`, à créer depuis `main` **à jour, s08 mergée**
(voir la note de numérotation des migrations, tâche 1).

> **Sources** :
>
> - recherche : `docs/research/s08-formulaire-contact.md` — la story est issue de la scission de s08
>   et n'a pas de recherche propre ; celle de s08 couvre le limiteur de s03, l'action publique de
>   `/contact` et le registre des paramètres d'association ;
> - plan jumeau : `docs/plans/s08-formulaire-contact.md`, dont ce plan est tiré ;
> - design : la story **n'a pas d'écran à elle**. Le seul rendu qu'elle ajoute est le cinquième état
>   du formulaire de `/contact`, déjà dessiné dans `docs/designs/s08-formulaire-contact.md`
>   (écran 1, « refus au seuil ») ; `/ks-design` n'est donc pas rejoué ;
> - design system : `docs/design-system.md` §3.1, §3.2, §3.9 (l'`alert` `destructive` ancré) ;
> - règles lues : `rule-architecture`, `rule-safe-server-action`, `rule-service`,
>   `rule-services-tests`, `rule-persistence`, `rule-transaction-dao`, `rule-logger`.

> **Issue de la scission de s08, décidée le 24/09/2026 au moment du plan.** Les trois critères
> ci-dessous viennent de s08 mot pour mot, et correspondent à la ligne du PRD « Limitation de débit des
> formulaires publics » (complexité 1), celle que **s10 doit réemployer**.
>
> **L'ordre est une contrainte, pas une préférence : s08 d'abord, s08b ensuite.** Un limiteur sans
> formulaire ne protège rien — sans l'action publique réécrite par s08, ce plan n'a aucun appelant, le
> critère 1 n'a pas d'écran où se prouver, et l'e2e du seuil n'a pas de formulaire à soumettre. Le
> plan de s08 dit, en sa décision F, ce que devient `/contact` dans l'intervalle : **sans limitation de
> débit**, le garde-fou étant que **s12b (mise en ligne) dépend de s08b** et interdit de publier le
> site avant cette story.

## Target story

**En tant que** membre du bureau **je veux** que les formulaires publics soient protégés du spam
**afin de** ne pas passer mon temps bénévole à trier des messages automatiques. Complexité 1, dépend
de s08.

1. Au-delà d'un nombre d'envois **par heure et par visiteur** fixé en paramètre de tenant, une
   soumission supplémentaire est refusée avec un message explicite ; en deçà du seuil, elle passe.
2. Le compteur repose sur une empreinte d'adresse IP hachée : **aucune adresse IP en clair** n'est
   écrite en base.
3. Une opération de purge supprime toute empreinte de **plus de 24 h** et n'en touche aucune autre ;
   elle s'exécute à chaque soumission **et** peut être appelée seule, hors de toute soumission —
   vérifié par un test sur des empreintes de part et d'autre des 24 h.

### Ce que s08 a déjà posé, et qui ne se rouvre pas ici

- La table `contact_message` **n'a aucune colonne d'adresse** (ADR 025) : le critère 2 est tenu par
  construction du côté des messages, et il ne reste à le tenir que du côté du compteur.
- L'action publique de `/contact` a été **entièrement réécrite** par s08 : plus de
  `RateLimiterMemory`, plus d'IP écrite dans un `metadata` jsonb. Ce plan n'a rien à nettoyer, il a à
  **insérer une étape** (décision F).
- Les dettes du design system (`--destructive-text`, tokens de tableau, jumelles sombres de
  `theme.ts`) ont été payées par s08. s08b n'en porte aucune et n'ajoute **aucun token**.

### Décisions tranchées par ce plan

**A. Le limiteur — une seule table, une fenêtre horodatée.** `rate_limit_event` (s03) est
**généralisée**, elle n'est pas dupliquée : sa colonne `day date` devient `window_start timestamptz`,
et sa purge prend un **seuil** au lieu d'un jour.

- **Pourquoi généraliser plutôt qu'ajouter une table sœur** : la note de s10 exige de réemployer
  « le limiteur livré par s08, ne pas en écrire un second ». Deux tables quasi identiques, c'est deux
  policies RLS, deux purges, et un critère 3 (« n'en touche aucune autre ») qui devient ambigu dès
  qu'il faut dire _dans quelle table_.
- **Fenêtre horaire fixe** (début de l'heure courante), pas glissante. La fenêtre glissante impose de
  garder une ligne par envoi, donc de multiplier les empreintes et de perdre l'**incrément atomique**
  `on conflict do update set count = count + 1` qui est tout l'intérêt du schéma de s03. Coût assumé
  et à dire : un visiteur peut envoyer jusqu'à 2 × N messages à cheval sur un changement d'heure.
- **s03 garde exactement son comportement** : elle passe le début du jour (Europe/Paris) comme
  `window_start` et purge avec le seuil « minuit aujourd'hui ». Sa chaîne de bout en bout est
  inchangée, seules la signature du repository et les assertions de ses deux fichiers de test
  bougent.
- **Invariant qui rend la table partagée sûre** : chaque purge n'efface que des lignes dont la
  fenêtre est **déjà close pour tous les usages**, parce que le seuil de purge est toujours antérieur
  ou égal au début de la fenêtre courante de l'usage le plus long (le jour). La purge de s03
  (minuit) et celle de s08b (maintenant − 24 h) sont donc inoffensives l'une pour l'autre — et c'est
  exactement ce que le critère 3 fait tester.
- **L'usage entre dans l'empreinte** : `RateLimitPurposeConst = {MAGIC_LINK_ADDRESS:
'magic_link.address', CONTACT_IP: 'contact.ip'}`. La chaîne de s03 est reprise **au caractère près**
  pour que ses compteurs et ses tests restent valides.

**B. L'adresse IP et son empreinte.**

- **Source** : la **dernière** entrée de `x-forwarded-for` (celle qu'ajoute le reverse proxy de
  confiance, `$proxy_add_x_forwarded_for`), sinon `x-real-ip`. **Pas la première** : la première est
  fournie par le client, et un limiteur qui la lit se contourne en changeant une valeur d'en-tête.
- **Sans IP résoluble : on laisse passer, sans compter**, avec un `logger.warn`. Le seau partagé
  `'unknown'` a été écarté : à 3 envois par heure, une passerelle mal configurée couperait le
  formulaire pour **tous** les visiteurs de l'association, ce qui est une panne pire que le spam
  qu'elle éviterait. Le cas n'est atteignable que sur un déploiement sans reverse proxy — s12b a la
  vérification des en-têtes à sa charge, et ce plan l'y laisse.
- **Empreinte** : `HMAC-SHA256(env.BETTER_AUTH_SECRET, "<organizationId>\n<usage>\n<ip>")`, le patron
  exact de s03. **Jamais un hash nu** : 2³² adresses IPv4 se renversent par force brute, un SHA-256
  sans secret n'est pas une pseudonymisation.
- **L'IP ne traverse qu'un seul appel de façade**, `consumeContactMessageQuotaService`, dont
  l'intercepteur porte déjà `shouldLogDetails: () => false`
  (`rate-limit-service-logger-interceptor.ts`). Le service des messages livré par s08 ne la reçoit
  jamais — sa signature n'en prévoit pas — et `contact_message` n'a aucune colonne où l'écrire.

**C. La purge hors requête — boucle `withTenant`, pas `withRlsBypass()`.** `organization` est exemptée
de RLS et se lit sans scope : la purge liste les associations, puis ouvre `withTenant` pour chacune.
`withRlsBypass()` est écarté — AGENTS.md en fait un point d'arrêt de revue, et le coût évité (une
requête au lieu de six) ne le justifie pas. **Piège à ne pas retomber dedans** : sous RLS forcée, une
suppression sans scope ne supprime rien **et ne lève rien** ; un test unitaire à repositories mockés
serait vert sur une purge qui n'efface rien en vrai. La preuve est e2e, en SQL (tâche 3).

**D. Où s'arrête s08b pour la purge.** s08b livre **la fonction de service** (appelable sans requête
HTTP ni domaine) **et un script `tsx` d'une douzaine de lignes** qui l'appelle. Rien d'autre : ni
route, ni cron, ni entrée dans `scheduled_job`. Le script est le point d'entrée « appelable seule »
que le critère 3 demande de **vérifier par un test** — sans lui, le critère n'est pas prouvable de
bout en bout. s12b y branche son déclencheur quotidien, s26 peut le reprendre dans `scheduled_job`
sans changer l'opération.

**E. Le seuil** : clé `contact.messages_per_visitor_per_hour`, type `number`, facultative, **défaut
`3`**, **min 1, max 20**, entière, `unitKey: 'units.messagesPerHour'`, page `settings` — le patron
exact de `login.link_requests_per_address_per_day` (s03), pour que la page « Réglages », qui est
**générée** depuis le registre, l'affiche sans écran nouveau. Défaut 3 : c'est le précédent de s03,
c'est aussi la valeur illustrée par la maquette, et un visiteur légitime envoie un message, pas
trois. Getter `getContactMessagesPerHourLimit(settings)` à côté de `getMagicLinkDailyRequestLimit`.

**F. Où le quota s'insère dans l'action de s08** : **entre la validation et l'écriture**. L'ordre
complet devient validation Zod → consommation du quota → écriture → notification. Seule une
soumission **bien formée** consomme du quota : un visiteur qui corrige une faute de frappe ne se fait
pas couper, et une soumission invalide ne coûte ni écriture ni email. L'action de s08 a été écrite
pour que cette insertion tienne en un appel, sans réécriture de son enchaînement.

C'est aussi l'endroit où le **cinquième état** du formulaire apparaît : le membre `'rate_limited'` et
son `limit?: number` sont **ajoutés ici**, pas laissés vides par s08 — un état qu'aucun chemin ne
produit n'est pas testable.

**G. Hors périmètre, dit et non comblé** : champ piège anti-spam (le design system ne prévoit « aucun
captcha visible » et le PRD ne demande que le débit), captcha de toute nature, limitation par compte
ou par session, blocage d'IP, journal d'événements de sécurité, seuil par formulaire (un seul seuil
pour les formulaires publics de l'association, s10 le réemploie tel quel), et
`RateLimiterMemory` du blog hérité (`(public)/blog/[slug]/actions.ts`) qui **garde** son limiteur en
mémoire et donc la dépendance `rate-limiter-flexible` : il n'est pas multi-tenant, il n'est pas dans
le périmètre du PRD, et le toucher élargirait le diff sans servir un critère.

## Tasks (ordered)

1. [x] **Le limiteur devient générique : fenêtre horodatée, usage, seuil paramétrable** (décisions A,
       B et E).
   - `src/db/models/rate-limit-model.ts` : `day date` → `window_start timestamptz NOT NULL`, index
     unique `(organization_id, fingerprint, window_start)`. **Deux migrations, dans cet ordre** :
     un `drizzle-kit generate --custom` qui `TRUNCATE TABLE rate_limit_event;` — sans quoi l'ajout
     d'une colonne `NOT NULL` sans défaut échoue sur une table peuplée —, puis la migration générée
     du schéma. Conséquence assumée et strictement permissive : les compteurs en cours sont remis à
     zéro au déploiement, sur une table dont les lignes vivent au plus une journée.
     ⚠️ **Rebaser sur `main` à jour avant de générer** : le lot s06 à s09 génère **une `0018`
     chacune** et le journal Drizzle (`drizzle/migrations/meta/_journal.json`) ne se fusionne pas à la
     main (AGENTS.md l'interdit). s08b arrive après s08 : brancher depuis un `main` qui la contient,
     ou **régénérer** après rebase — jamais recoudre.
   - `src/db/repositories/rate-limit-repository.ts` : `incrementRateLimitCounterDao({organizationId,
fingerprint, windowStart})` (même `on conflict do update`, même atomicité) ;
     `purgeRateLimitCountersDao(organizationId, cutoff: Date)` supprime `window_start < cutoff` et
     **rend le nombre de lignes supprimées** (le script et l'e2e en ont besoin).
   - `src/services/rate-limit-service.ts` : `RateLimitPurposeConst` (`magic_link.address` **repris au
     caractère près**, `contact.ip`), `fingerprintOf(organizationId, purpose, value)`,
     `dayWindowStartOf(instant)` (minuit Europe/Paris) et `hourWindowStartOf(instant)` (début de
     l'heure ; les décalages de Paris sont des heures entières, la troncature UTC coïncide).
     `consumeMagicLinkRequestQuotaService` **garde sa signature et son comportement** et passe
     `dayWindowStartOf` ; nouveau `consumeContactMessageQuotaService({organizationId, ip}):
Promise<{allowed: boolean; limit: number}>`, **sans contrôle d'autorisation et c'est délibéré**
     (visiteur anonyme), qui lit `getContactMessagesPerHourLimit`, purge à 24 h puis incrémente,
     le tout dans `withTenant`. `ip` absente ou vide → `{allowed: true}` **sans compter**, avec un
     `logger.warn` (décision B).
   - Façade `rate-limit-service-facade.ts` : la nouvelle méthode. L'intercepteur porte déjà
     `shouldLogDetails: () => false` — **le vérifier, ne pas le retirer** : c'est ce qui garde l'IP
     hors des journaux.
   - Paramètre d'association (décision E) : `CONTACT_MESSAGES_PER_HOUR_SETTING_KEY`, son entrée dans
     `ASSOCIATION_SETTINGS_REGISTRY`, le getter `getContactMessagesPerHourLimit`, les libellés
     (`fields.contactMessagesPerHour.label` / `.help`, `units.messagesPerHour`) dans `messages/fr.json`,
     et la vérification de `src/db/scripts/tenant-settings-seed.ts`.
   - **Tests** (`rate-limit-service.test.ts`, `rate-limit-repository.test.ts`, repositories mockés) :
     - **non-régression s03** : le quota de lien de connexion compte toujours par jour, avec la même
       empreinte pour la même adresse (la chaîne d'usage n'a pas changé) ;
     - deux usages, même association, même valeur d'entrée → **deux empreintes différentes** ;
     - l'empreinte est un HMAC de 64 caractères hexadécimaux, et ne contient jamais la valeur
       d'entrée ;
     - deux associations, même IP → empreintes différentes ;
     - en deçà du seuil `allowed: true`, au-delà `allowed: false`, seuil lu dans les paramètres et
       non en dur ;
     - sans IP : `allowed: true` et **aucun incrément** ;
     - la page « Réglages » générée affiche la nouvelle clé (`association-settings-form.test.tsx`)
       et le seed la connaît (`tenant-settings-seed.test.ts`).

2. [x] **La purge appelable seule** (décisions C et D).
   - `src/db/repositories/organization-repository.ts` : `getAllOrganizationIdsDao(): Promise<string[]>`
     — `organization` est exemptée de RLS, elle se lit hors scope.
   - `src/services/rate-limit-service.ts` : `purgeExpiredRateLimitFingerprintsService():
Promise<{organizations: number; deleted: number}>` — seuil `maintenant − 24 h`, **boucle sur les
     associations avec `withTenant` pour chacune**, aucun `withRlsBypass()`. Exportée par la façade.
   - `src/db/scripts/purge-rate-limit-fingerprints.ts` : une douzaine de lignes, appelle la façade,
     écrit le compte sur la sortie standard, code de sortie non nul en cas d'échec. **Ni route, ni
     cron, ni `scheduled_job`** : c'est le déclencheur de s12b, pas celui de s08b.
   - La purge s'exécute **aussi** à chaque soumission, dans le scope du tenant courant (tâche 1).
   - **Tests** : unitaires — la boucle ouvre un scope par association et n'appelle jamais
     `withRlsBypass` ; le seuil vaut bien `maintenant − 24 h`. **La vraie preuve est l'e2e de la
     tâche 3** : un test unitaire à repositories mockés reste vert sur une purge qui n'efface rien
     sous RLS.

3. [x] **Le quota dans l'action publique, le cinquième état du formulaire, la preuve e2e et la
       documentation d'architecture** (décision F).
   - `src/app/[locale]/(public)/contact/actions.ts` : insérer
     `consumeContactMessageQuotaService({organizationId, ip})` **entre la validation et l'écriture**,
     avec l'IP lue selon la décision B (dernière entrée de `x-forwarded-for`, sinon `x-real-ip`).
     Le type de retour gagne `'rate_limited'` et `limit?: number`. **L'IP n'est jamais passée à la
     façade des messages** ; la lecture des en-têtes vit dans l'action, pas dans un service.
   - `src/app/[locale]/(public)/contact/contact-form.tsx` : le cinquième état du design — `alert`
     `destructive` ancré (`role="alert"`, `tabindex="-1"`, bordure 2 px, §3.1 et §3.9), **texte saisi
     conservé**, bouton d'envoi désactivé, seuil interpolé depuis la réponse. Clé
     `ContactPage.errors.rateLimit` dans `messages/fr.json`, à sa nouvelle forme (s08 a retiré
     l'ancienne).
   - `e2e/rate-limit.spec.ts` — spec **propre au limiteur**, sur le patron de `e2e/contact.spec.ts`
     (tenants A et B, mêmes comptes, SQL direct). Il pilote le formulaire de `/contact` parce que
     c'est son seul appelant, mais il reste séparé pour que s10 puisse l'étendre sans toucher au spec
     des messages. Contextes navigateur avec `extraHTTPHeaders: {'x-forwarded-for': …}` **et des
     adresses distinctes par cas**, sans quoi les cas se polluent entre eux.
     - **Critère 1** : seuil réglé à 1 dans « Réglages » ; le deuxième envoi de la **même** IP est
       refusé avec le message explicite et le texte saisi conservé ; un envoi depuis une **autre** IP
       passe. Puis seuil remonté : l'envoi suivant de la première IP repasse (le seuil est bien lu à
       chaque soumission, pas figé au démarrage).
     - **Critère 2** : en SQL, aucune valeur de `contact_message` ne contient l'IP du test, et les
       `fingerprint` de `rate_limit_event` sont **64 caractères hexadécimaux** — donc ni l'IP, ni rien
       qui la contienne.
     - **Critère 3** : insérer en SQL trois empreintes — une de **25 h** et une de **1 h** sur A, une
       de 1 h sur B —, lancer **`pnpm tsx src/db/scripts/purge-rate-limit-fingerprints.ts`**, vérifier
       que **seule** celle de 25 h a disparu, **y compris sur B** (c'est ce qui prouve que la boucle
       `withTenant` traverse bien les associations et que la RLS ne rend pas la purge silencieusement
       inopérante). Puis la même vérification **sans script**, par une soumission : la purge s'exécute
       aussi à chaque envoi.
     - **Non-régression de s03** : `e2e/magic-link.spec.ts` reste vert — le quota journalier du lien
       de connexion compte comme avant.
   - ⚠️ **Vérifier `e2e/contact.spec.ts`** (livré par s08) : il envoie plusieurs messages valides
     d'affilée et doit rester vert sous un seuil par défaut de 3 par heure. s08 lui a posé un
     `extraHTTPHeaders` fixe pour cela ; si le spec a néanmoins un cas qui dépasse le seuil, c'est
     **ici** qu'on le corrige, pas en relevant le défaut.
   - `docs/architecture.md` : `rate_limit_event` mise à jour (fenêtre horodatée, **deux usages**,
     purge par seuil, table partagée et son invariant) ; le paragraphe sur la limitation de débit des
     formulaires publics — que s08 avait seulement corrigé pour ne plus décrire un limiteur disparu —
     **réécrit au passé et définitivement** : empreinte HMAC liée à l'usage, purge sous 24 h,
     déclenchée à chaque soumission et par le script, planifiée par s12b, en précisant que le blog
     hérité garde le sien en mémoire.
   - **Vérifié par** `pnpm check:rules` et par la revue.

## Files touched

**Créés**

- purge : `src/db/scripts/purge-rate-limit-fingerprints.ts` ;
- migrations `drizzle/migrations/00NN_*.sql` (troncature de `rate_limit_event` en `--custom`, puis
  schéma du limiteur générée) et leurs instantanés ;
- e2e : `e2e/rate-limit.spec.ts` ;
- **documents de la story** : `docs/plans/s08b-limitation-debit-formulaires.md`. (Pas de recherche ni
  de design propres : ceux de s08 couvrent la story, voir les sources.)

**Modifiés**

- `src/db/models/rate-limit-model.ts`, `src/db/repositories/rate-limit-repository.ts` (+ son test),
  `src/db/repositories/organization-repository.ts` ;
- `src/services/rate-limit-service.ts` (+ `src/services/__tests__/rate-limit-service.test.ts`),
  `src/services/facades/rate-limit-service-facade.ts`,
  `src/services/types/domain/association-settings-types.ts` ;
- `src/db/scripts/tenant-settings-seed.ts` et son test ;
- `src/app/[locale]/(public)/contact/{actions.ts,contact-form.tsx}` (+ leurs tests) ;
- `messages/fr.json` (seuil et son unité, `ContactPage.errors.rateLimit`) ;
- `docs/architecture.md`.

**Explicitement non touchés**

- Tout ce que s08 a livré et que ce plan n'a aucune raison de rouvrir :
  `src/db/models/contact-message-model.ts` et son repository,
  `src/services/contact-message-service.ts` et sa façade, `src/app/dal/contact-message-dal.ts`, les
  écrans `/bureau/messages`, `src/lib/emails/contact-message-email.tsx`,
  `contact-form-validation.ts`, `src/app/globals.css`, `src/components/ui/{table,form}.tsx`,
  `src/lib/emails/theme.ts`, `docs/design-system.md`.
- `user_submissions` et sa chaîne (ADR 025), `e2e/tenant-isolation.spec.ts`,
  `src/db/scripts/seed.ts`.
- Le limiteur en mémoire du blog hérité (`(public)/blog/[slug]/actions.ts`) et la dépendance
  `rate-limiter-flexible`, qui restent (décision G).

## Test strategy

- **Unitaire (Vitest, `pnpm test --run` — jamais `pnpm test` seul, qui reste en mode veille)** :
  empreintes et fenêtres du limiteur (deux usages, deux associations, forme du HMAC), seuil lu dans
  les paramètres et non en dur, absence d'IP traitée comme un laisser-passer sans incrément, boucle de
  purge qui ouvre un scope par association et n'appelle jamais `withRlsBypass` ; test d'action pour le
  refus au seuil ; composant jsdom pour le cinquième état du formulaire.
- **e2e (Playwright, contre le **build de production**, base éphémère seedée)** : les trois critères
  de bout en bout. La RLS, l'absence d'IP en base et surtout **l'efficacité réelle de la purge** ne
  sont prouvables que là — un test unitaire à repositories mockés reste vert sur une purge qui
  n'efface rien.
- **Non-régression** : les suites de s03 (`rate-limit-service.test.ts`,
  `rate-limit-repository.test.ts`, `e2e/magic-link.spec.ts`) **changent d'assertions mais pas de
  comportement observable** — c'est le point à surveiller en revue : une assertion qui bouge doit
  correspondre à une signature qui bouge, jamais à un comportement qui change. `e2e/contact.spec.ts`
  et les suites de messages de s08 restent verts sans modification, hors le cas signalé en tâche 3.
- `pnpm lint`, `pnpm tsc --noEmit` (supprimer `.next/types/routes.d.ts` si `tsc` ne se plaint que de
  `.next/`), `pnpm check:rules`. **Pas de `pnpm build` automatique** (AGENTS.md), sauf pour servir
  l'e2e.

## Definition of Done

- Un commit de story sur `feature/s08b-limitation-debit-formulaires`, portant le plan et le code ; un
  second commit **seulement** pour les deux migrations, si l'implémenteur juge utile de pouvoir les
  révoquer seules.
- Les trois critères sont couverts par des tests verts, unitaires **et** `e2e/rate-limit.spec.ts`,
  la purge étant prouvée **de part et d'autre des 24 h** et **sur deux associations**.
- **Aucune adresse IP nulle part en base**, dans aucun journal, dans aucun argument de méthode de
  service journalisée : l'IP ne traverse que `consumeContactMessageQuotaService`, dont l'intercepteur
  porte `shouldLogDetails: () => false`.
- **Aucun `withRlsBypass()` nouveau** hors des e2e.
- **Un seul limiteur dans le produit** : `rate_limit_event` généralisée, aucune seconde table, aucun
  second service — c'est ce que s10 réemploiera.
- Aucune valeur métier en dur : seuil en paramètre d'association (ADR 010), libellés dans
  `messages/fr.json`.
- Aucune régression sur le quota de lien de connexion de s03 (comportement identique), ni sur les
  écrans et les tests livrés par s08. Lint et types propres.
- `pnpm db:generate` ne produit plus de diff après les migrations.
- Revue `/ks-review` passée : `Ship allowed: yes`.

## Points à arbitrer avant validation

1. **Troncature de `rate_limit_event` à la migration.** Les compteurs en cours repartent à zéro au
   déploiement (effet strictement permissif, sur une table dont les lignes vivent au plus un jour).
   L'alternative — une migration `--custom` qui convertit `day` en `window_start` — préserve les
   compteurs pour trois lignes de SQL de plus. À trancher.
2. **Le seuil par défaut à 3 envois par heure et par visiteur**, et la fenêtre **fixe** plutôt que
   glissante, qui laisse passer jusqu'à 2 × 3 messages à cheval sur un changement d'heure. C'est le
   précédent de s03 et le coût assumé de l'incrément atomique ; à confirmer, ou à durcir en abaissant
   le défaut — jamais en passant à la fenêtre glissante sans rouvrir la décision A.
3. **Un seul seuil pour tous les formulaires publics de l'association** (décision G) : s10 réemploiera
   `contact.messages_per_visitor_per_hour` tel quel, donc un visiteur qui écrit au bureau consomme le
   quota qui le limitera aussi pour un signalement de fuite. _Proposition_ : accepter — un seuil par
   formulaire multiplierait les clés de réglage pour une association qui en a déjà beaucoup, et rien
   dans le PRD ne le demande. À renverser **maintenant** si on le souhaite : après s10, la clé sera
   partagée par deux stories.
