# Revue s26-envoi-echelonne

Diff jugé : `git diff main...feature/s26-envoi-echelonne` (trois commits : `14774379` feat, `efea7bb3` fix, `49170a62` fix).

Historique : la revue 1 a trouvé un majeur M1 (ligne `sending` jamais balayée après un plantage). Le correctif `efea7bb3` l'a réduit sans fermer toute la fenêtre (revue 2, majeur résiduel). Le correctif `49170a62` le ferme ; cette revue 3 est complète.

Synthèse : aucun critique, aucun majeur, trois mineurs.

## 1. Tests (lancés par le reviewer)

`pnpm test --run` : 338 fichiers passent, 4237 tests passent, 1 ignoré. Aucun timeout. Ni build ni e2e lancés (`e2e/campaigns.spec.ts` à valider en CI).

## 2. Vérification des correctifs

### M1 et fenêtre résiduelle : fermés

- **Plantage 12 min après la pose du verrou.** La ligne reste `sending`, la tâche garde `locked_at`. Le claim ne reprend que les tâches libres ou au verrou périmé et rend l'ancien `locked_at` (`previousLockedAt`), donc `resumedAfterStaleLock` est vrai. `sweepAbandonedRecipients` appelle `markSendingRecipientsToVerifyTxnDao(partId)`, sans condition d'âge, avant la lecture des lignes `pending` : la ligne passe `to_verify` et n'est jamais renvoyée.
- **Gestionnaire qui lève.** L'erreur est attrapée dans `runOrganizationJobs`, aucune issue n'est écrite, le verrou reste. Après 15 min la prise suivante est une reprise et le balayage nettoie la ligne. Les issues `retry` / `released` / `completed` / `failed` remettent le verrou à nul : la prise suivante est une exécution normale, la ligne fautive ayant déjà été passée explicitement en `to_verify` ou `pending`.
- **Chemins menant à `sent`.** Le seul est `finishPart` : il balaie les lignes `sending` en `to_verify`, passe la part `sent`, puis la campagne `sent` si aucune part n'est inachevée, dans une même transaction `withTenant`. Une part ne se clôt donc jamais avec une ligne `sending`. `failedAttemptOutcome` pose `interrupted` / `failed`, jamais `sent`.

### Pas de double envoi, SQL du claim correct

- CTE `due` : `id` et `locked_at AS previous_locked_at`, filtre organisation, types, `run_after <= now`, `completed_at` et `failed_at` nuls, `locked_at` nul ou périmé, tri `run_after, id`, `FOR UPDATE SKIP LOCKED`. L'`UPDATE … FROM due` pose `locked_at` et `attempts + 1` une seule fois et rend l'ancien verrou. Isolation par `getDb()` sous `withTenant`, sans `withRlsBypass`.
- Une ligne `to_verify` n'est jamais reprise : `getPendingPartRecipientsDao` ne lit que `pending`, `claimRecipientForSendTxnDao` ne prend que `pending`, toutes les transitions vers `to_verify` sont gardées sur `sending`.

### Un gestionnaire vivant n'est pas pris pour une reprise

`resumedAfterStaleLock` n'est vrai que si l'ancien `locked_at` était non nul. Premier passage, ou passage après `retry` / `released` / `completed` / `failed` : verrou nul.

### Tests

Tests réels, pas sans assertion : plantage à 12 min, gestionnaire qui lève puis reprise, part qui ne se clôt jamais sur `sending`, ligne récente non balayée en première exécution, balayage au-delà du seuil, transmission de l'indicateur de reprise, forme du SQL et ancien verrou rendu.

### Architecture et docs

Aucun service n'importe sa façade. Aucun nouveau `withRlsBypass` dans le code. `docs/exploitation/README.md` §8.2 décrit les trois cas et signale que l'ADR 052 (immuable) écrit encore 15 minutes.

## 3. Plan et ADR

Diff conforme au plan (schéma et RLS, planificateur, minuterie systemd, parts, suivi des destinataires, écrans, docs). Aucune contradiction avec les ADR 006, 036 §5, 045, 051, 052, 033. Rien en dur : plafond et tentatives sont des paramètres d'association ; les constantes de 5 et 15 min sont techniques et documentées.

## 4. Checklist

- Tests exécutés et verts : oui
- Références vérifiées : oui
- Plan vs diff : oui
- Assertions pinant les critères : oui
- AGENTS.md et ADR : oui
- Multi-tenant (`getDb`, `withTenant`, pas de nouveau bypass) : oui
- Couches sans import service → façade : oui
- Régressions : aucune (suite complète verte)

## 5. Constats

### Critiques

Aucun.

### Majeurs

Aucun.

### Mineurs

- **m1.** Le SQL du claim (CTE, `previous_locked_at`) n'est vérifié en unitaire que comme chaîne SQL. Le comportement sous Postgres réel n'est couvert par rien d'exécuté ici : à confirmer sur l'e2e en CI.
- **m2.** Un gestionnaire qui dépasserait 15 min serait repris comme une reprise : sa ligne vivante passerait `to_verify`, sans doublon d'envoi. Irréaliste à 100 envois par part, et non nouveau.
- **m3.** Le JSDoc de `CAMPAIGN_RECIPIENT_SENDING_STALE_MS` dans `src/services/types/domain/campaign-types.ts` argumente encore « strictement sous le verrou », raisonnement devenu secondaire. Cosmétique.

Points hérités des revues précédentes, non bloquants : la gestion du `catch` de `runOrganizationJobs` (verrou conservé, tentative comptée) est assumée ; `docs/designs/s25.zip`, `docs/designs/s26.zip` et `docs/logs/` ne sont pas suivis et ne doivent pas être commités.

## 6. Revue 4 : après les correctifs de CI (`dd05ad11`, `91027197`)

Diff complet relu, avec focus sur les deux derniers commits. L'e2e de la CI avait révélé un défaut de production que les trois premières revues n'avaient pas vu.

**Défaut corrigé (`91027197`).** `getCampaignFooterTexts` appelait `getTranslations` de `next-intl/server`, qui lève hors de Next : le script du planificateur (minuterie systemd) ne pouvait composer aucun email de campagne. Les destinataires des parts 2 et suivantes seraient passés `to_verify` sans rien recevoir, sans erreur visible (sortie 0), sans doublon. La part 1 passait car elle part depuis le serveur (`after()`).

- **Pied d'email : conforme.** `createTranslator` de `next-intl` avec `messages/fr.json` (ADR 008, `fr` seule), identique dans Next et dans le script, mêmes clés et même texte qu'avant. Le test `campaign-email-footer.test.ts` simule `next-intl/server` en erreur et vérifie les chaînes exactes : il échouerait au retour de `getTranslations`.
- **Composition avant la prise : conforme.** Ordre : composer, puis `pending → sending`, puis envoi, puis `sent` / `refused → pending` / autre erreur → `to_verify`. La composition n'a pas d'effet de bord. Un échec de composition laisse la ligne `pending` et reprogramme la part (+30 min × tentative) ; un échec sans fin aboutit au chemin d'échec définitif à la dernière tentative. Pas de double envoi, « jamais deux fois » intact.
- **API propres à Next atteignables depuis le script : aucune.** Fermeture des imports de la façade du planificateur (168 fichiers) cherchée pour `next/headers`, `next/cache`, `next-intl/server`, `getLocale`, `getTranslations`, `cookies`, `headers`, `unstable_cache`, `use cache`, `after`. Les occurrences sont hors du chemin de livraison (autres fonctions d'`email-service`, `auth-service`, autres gabarits). `after()` n'est que dans `runImmediatePass`, côté action.
- **e2e (`dd05ad11`, `91027197`) : conformes.** Localisateurs ciblés (en-tête du `h1`, tableau « Envois par jour », décomptes bornés aux destinataires de la campagne). Aucune assertion affaiblie. `diagnosisOf` n'expose que des statuts, des compteurs et la fin de la sortie du script, sans donnée personnelle, via `inTenantScope`.
- **Règles et ADR : conformes.** Aucun nouveau `withRlsBypass`, aucun service n'importe une façade, aucune variable d'environnement nouvelle, rien en dur.

**Tests (lancés par le reviewer) :** 337 fichiers passent, 2 échouent par timeout de worker sur le montage 9p (`src/app/[locale]/fonts.test.ts`, `src/lib/better-auth/magic-link-integration-imports.test.ts`) ; relancés seuls, 7/7 passent. Compté comme vert (faux positif connu), pas comme défaut de la story. Run de l'implémenteur : 339 fichiers, 4239 tests verts. `tsc` propre. Ni build ni e2e.

**Constats de la revue 4 (aucun critique, aucun majeur) :**

- **m4.** `email-service.ts` importe `next-intl/server` statiquement. Sans effet aujourd'hui (l'import ne lève pas, seul l'appel le ferait), mais un futur appel à `getTranslations` sur un chemin du planificateur rouvrirait ce défaut. Piste : une garde de test sur la fermeture des imports de `run-scheduled-jobs.ts`, ou une note dans l'ADR du planificateur. À prévoir avant s29 et s52, dont les emails partiront aussi du script.
- **m5.** Une composition qui échoue en permanence pour un destinataire bloque toute la part jusqu'à épuisement des tentatives, puis la campagne passe `interrupted`. Cohérent avec la politique d'échec existante.

Les constats m1 à m3 des revues précédentes restent mineurs et non bloquants. L'e2e n'a toujours pas tourné en local : sa validation est celle de la CI de la PR.

Max severity: minor
Ship allowed: yes
