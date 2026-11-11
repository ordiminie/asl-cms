# Research — Story s25-campagnes-email

Recherche du 10 novembre 2026, sur `main` à `d663997a` (s24 mergée, PR 62). `docs/reviews/stories.md` : `Stories ready: yes`.
Dépendances s02, s03, s12 : livrées (s02 #13, s03 + s03c #24, s12 #37, s12d #45). Aucun `docs/research/s25*`, `docs/plans/s25*`,
`docs/designs/s25*` ni branche `feature/s25-*` n'existe. Rien n'a été exécuté (ni test, ni migration) : tout ce qui suit vient de la
lecture du code.

## Target story

**Envoyer une campagne email aux membres** — complexité 3, **story avec écran** (composer, aperçu, archive en back-office, page publique de
désinscription, mention sur la fiche). N'importe quel membre du bureau compose une campagne, choisit un des 4 modèles ou le mode libre, et
l'envoie **à tous les membres, et à eux seuls** (le ciblage « impayés » et les groupes sont à s27).

Critères d'acceptation (docs/stories.md l. 1968-2030) :

1. N'importe quel membre du bureau compose, choisit un des 4 modèles ou le mode libre, envoie aux membres **ayant une adresse email**.
2. Le nombre de destinataires est affiché **avant** l'envoi, en distinguant ceux qui ont un email de ceux qui n'en ont pas.
3. Tout envoi, modèle ou libre, porte le **même habillage** : en-tête au logo de l'association, pied de page avec mentions et lien de désinscription.
4. Variables dynamiques (nom, parcelle, date) remplacées par les valeurs du destinataire ; une **variable inconnue est signalée avant l'envoi**,
   jamais laissée telle quelle dans l'email reçu.
5. Un **aperçu** montre le rendu final avec les données d'un destinataire **réel** avant l'envoi définitif.
6. Suivre le lien de désinscription enregistre le refus, le **confirme à l'écran**, et se voit **sur la fiche côté bureau**.
7. Un désinscrit est **exclu de la cible suivante et de son décompte** : exclusion **totale** ici (la distinction facultatif/statutaire est s27b).
8. La campagne envoyée est **archivée** (contenu, cible, date), consultable en back-office.
9. Une campagne d'une association ne peut pas cibler les membres d'une autre.

Notes agentiques qui contraignent : le gabarit commun enveloppe aussi le mode libre (« un agent qui traite la campagne libre comme un envoi brut
rate la story ») ; l'écran de confirmation **ne promet rien** sur ce que le membre continuera de recevoir (phrase propre à s27b) ; le gabarit est
alimenté par les **paramètres du tenant** (s02), pas par des constantes ; l'envoi doit être **interceptable** pour que s26 (budget quotidien
300/jour, report au lendemain) n'impose pas de tout reprendre ; l'envoi de facture double celui de Pennylane, il ne le remplace pas. Dépendants
futurs qui lisent ce qu'on pose ici : s26, s27 (ciblage), s27b (nature, réintégration au **calcul de la cible**, « point de passage unique posé
par s25 »), s28, s29, s30 (statistiques), s38 (export), s42 (le lancement réutilise le gabarit commun).

## Current state of the code

**Rien n'existe de la communication de masse** : aucune table `campaign`, `email_template`, `unsubscribe`, `recipient_group`, `daily_send_budget`
ni `scheduled_job` (`src/db/models/` ne contient que `app-settings`, `board-member`, `member-note`, `member-profile`, `member-role-event`,
`organization`, `organization-setting`, etc.) ; aucun code ne contient « désinscription » ni `List-Unsubscribe`. `docs/architecture.md` l. 340 les
**nomme** dans le périmètre « Communication » sans les définir. Prochaine migration : `0043`.

Ce qui existe et sur quoi on se branche :

- **Contrat d'envoi** — `src/lib/emails/transport/email-transport.ts` : `EmailMessage = {from, to, subject, html?, text}` et
  `EmailTransport = {send(message): Promise<void>}`. **Envoi unitaire seulement.** L'ADR 005 prévoyait un contrat plus large (« envoi de
  campagne, statistiques, **quota** ») ; l'ADR 017 et le code livré s'en tiennent à `send`. Implémentations `brevo`, `resend`, `file`, `memory`,
  choisies par `EMAIL_TRANSPORT` (`get-email-transport.ts`, singleton `getEmailTransport()`).
- **Brevo** — `brevo-transport.ts` : `POST https://api.brevo.com/v3/smtp/email` (API **transactionnelle**), corps `{sender, to:[{email}], subject,
htmlContent?, textContent}`. **Aucun champ `headers`.** Erreur typée `EmailTransportError`.
- **Point d'envoi unique** — `src/services/email-service.ts` (863 lignes) : `sendEmailService(payload, {recipientType})` rend le gabarit `react`
  en HTML puis appelle `getEmailTransport().send`. `recipientType` : `'admin' | 'client' | 'system'` ; `'system'` n'est **jamais** coupé par
  les interrupteurs d'application, `'client'` (le défaut) l'est par `EMAIL_ENABLED` et `EMAIL_ENABLED_FOR_CLIENTS`. Préfixe `[DEV]` en
  développement. L'**expéditeur** vient de `getEmailFrom()` : réglage d'application `email.communication_email`, sinon `env.EMAIL_FROM`, sinon
  `onboarding@resend.dev` — **global à la plateforme, pas par association**.
- **Gabarits** — `src/lib/emails/*.tsx` (react-email). Les gabarits d'association (`incident-report-email.tsx`, `contact-message-email.tsx`,
  `magic-link-email.tsx`) reçoivent `association: {name, accent, logoUrl?}` et portent **chacun leur en-tête et leur pied de page** : je n'ai pas
  trouvé de gabarit d'habillage commun réutilisable. Couleurs : `src/lib/emails/theme.ts` (`EMAIL_COLORS`, six teintes `EMAIL_ACCENTS`, design
  system §5).
- **Logo dans un email** — `pngLogoUrlOf(logoKey, origin)` : URL `…/api/identity/logo?v=<version>` **uniquement si le logo est un PNG**. Elle
  existe en **trois copies privées** (`incident-report-service.ts:138`, `contact-message-service.ts:107`, `magic-link-integration.ts:98`) ;
  l'upload accepte aussi le WebP (`IDENTITY_ACCEPTED_FORMATS.logo = ['png','webp']`), pour lequel l'email retombe sur le nom seul.
- **Paramètres d'association** — table `organization_setting` (`organization_id`, `key`, `value`, RLS forcée), registre en code
  `ASSOCIATION_SETTINGS_REGISTRY` (`association-settings-types.ts` l. 202) ; clés vues : adresse de contact (obligatoire), adresse du forage,
  teinte, demandes de lien/jour, nombre de membres, messages de contact/heure, description, code Google. Lecture :
  `getAssociationSettingsService(organizationId)` (volontairement **sans** contrôle d'accès, usage serveur). **Aucune clé de mentions légales,
  d'adresse postale ni de raison sociale** n'apparaît (`grep legal|mentions` vide dans ce fichier) : voir Open questions.
- **Fiche membre** — `member_profile` (`member-profile-model.ts`) : `id` (seule identité), `organization_id`, `name`, `email` (**nullable**, unique
  par association sans casse), `mail_only` **générée** (`email IS NULL`, « l'attribut que s25 et s28 liront »), `user_id`, coordonnées postales.
  **Aucun champ de désinscription.** Parcelles : `parcel_ownership` (période demi-ouverte `[startsOn, endsOn)`, `endsOn = null` = actuelle) ;
  `member-profile-repository.ts` sait déjà lister les **parcelles actuelles** de chaque fiche (`getCurrentParcelNumbersByProfile`) — un membre
  peut en avoir **plusieurs**.
- **Écrans bureau** — fiche `…/bureau/proprietaires/[id]` (`MemberProfileDetail`, cartes dans `DetailCard`, carte « Notes et échanges » de s24 en
  dernier). Pagination par `?page=` (actualités, analyses d'eau). Éditeur Markdown : `src/components/ui/markdown-editor.tsx` (Milkdown, ADR 007).
- **Route publique sans session** — les routes `/api/*` sont **exclues** du `matcher` de `src/proxy.ts` ; `/api/identity/[kind]` sert déjà le logo
  sans session. Le tenant vient du domaine appelé (Host), résolu côté serveur (`requireCurrentTenantDal`), jamais dans le proxy.
- **Limiteur** — `rate-limit-service.ts` : compteurs en base par finalité (`RateLimitPurposeConst`: `magic_link.address`, `contact.ip`), sur le
  modèle à imiter pour une page publique.
- **Tests d'envoi e2e** — `file-transport` écrit dans un « outbox » (`EMAIL_OUTBOX_DIR`) ; `e2e/incident-report.spec.ts` (l. 64-79),
  `contact.spec.ts` et `member-accounts.spec.ts` en lisent chacun **leur propre copie** d'un helper `OutboxMessage`.
- **Contenu des 4 modèles** — **non disponible.** `docs/Admin-MEL/` ne contient que le CDC V5, des listes de questions et la présentation ; le CDC
  §8.1 et l'Annexe A disent « reste à rédiger conjointement avec le client ». Conformément à la consigne de la story : livrer des modèles
  **câblés, à contenu provisoire clairement marqué**.

## Anchor points

- **Nouveau modèle** `src/db/models/…` + migration `0043_*` générée par `pnpm db:generate`, plus migration RLS **custom**
  (`drizzle-kit generate --custom`) calquée sur `0042_member_note_rls.sql` / `0036_…`, **par table métier**. À nommer au plan : au minimum
  `campaign` (archive : contenu, cible, date) et `unsubscribe` (refus d'un membre, clé = `member_profile.id`) ; peut-être des lignes
  destinataire par campagne (voir Open questions).
- **Repository** `src/db/repositories/…`, `getDb()`, jamais `db`. **Service** + **façade** + **intercepteur de logs** (`shouldLogDetails: () => false` :
  adresses et contenus de campagne) + validation + types de domaine + **règles pures** (`src/services/rules/` : remplacement des variables,
  détection de variable inconnue, calcul de cible — le « point de passage unique » de s27b).
- **Autorisation** — `ActionIdConst` + `ACTION_REGISTRY` (`action-registry-types.ts`) : aucune action « campagne » n'existe ; en déclarer une
  (`defaultRoles: ['owner','board']`, « n'importe quel membre du bureau »), avec les tests d'entrée de registre.
- **Envoi** — via `getEmailTransport().send` (ou un nouveau chemin de `email-service.ts`) ; **un seul** point d'envoi, interceptable, pour s26.
- **UI bureau** — nouvelle section sous `src/app/[locale]/(bureau)/bureau/…` (composer + aperçu + archive) ; carte ou mention de désinscription
  sur `MemberProfileDetail`. **UI publique** — page de confirmation de désinscription (publique, sans session).
- **Libellés** dans `messages/fr.json` ; gabarit d'email dans `src/lib/emails/` (+ test `real-i18n` sur le modèle des existants).
- **Seed / e2e** — `e2e/campaigns.spec.ts` (nouveau), outbox `file`.

## Verified APIs / functions

Toutes ouvertes dans le code.

| Élément                             | Signature / contenu                                                                            | Où                                                            |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `EmailTransport.send`               | `(message: EmailMessage) => Promise<void>` ; `EmailMessage = {from, to, subject, html?, text}` | `src/lib/emails/transport/email-transport.ts`                 |
| `getEmailTransport`                 | `() => EmailTransport` (singleton, `resolveEmailTransport(env)`)                               | `…/transport/get-email-transport.ts`                          |
| `sendEmailService`                  | `(payload: {to, subject, text, from?, react?}, options?: {recipientType?}) => Promise<void>`   | `src/services/email-service.ts:139`                           |
| `createBrevoTransport`              | corps sans `headers` ; `BREVO_SEND_URL`                                                        | `…/transport/brevo-transport.ts`                              |
| `getAssociationSettingsService`     | `(organizationId) => Promise<ResolvedAssociationSettings>` ; sous `withTenant`                 | `src/services/association-settings-service.ts:39`             |
| `ASSOCIATION_SETTINGS_REGISTRY`     | registre typé (`type`, `required`, `default`, `page`, clés de libellé)                         | `association-settings-types.ts:202`                           |
| `canPerformAction`                  | `(user, organizationId, actionId) => boolean`                                                  | `src/services/authorization/action-registry-authorization.ts` |
| `effectiveAuthor`                   | `(viewer, impersonator?) => TraceAuthor`                                                       | `src/services/types/domain/impersonation-types.ts`            |
| `withTenant` / `getDb`              | scope de transaction + `app.organization_id`                                                   | `src/db/tenant-scope.ts`                                      |
| `calendarDayOf`                     | `(instant: Date) => string` (jour de Paris)                                                    | `src/services/types/domain/water-analysis-types.ts`           |
| `consumeContactMessageQuotaService` | compteur en base par finalité                                                                  | `src/services/rate-limit-service.ts:182`                      |
| `mailOnly`                          | colonne générée `email IS NULL`                                                                | `member-profile-model.ts`                                     |

**Non vérifié** : le comportement réel de l'API Brevo `/v3/smtp/email` avec un en-tête `List-Unsubscribe` (champ `headers` du corps) et son
traitement par Brevo ; la tenue de 300 envois unitaires successifs depuis un processus Next ; l'existence d'une désinscription côté Brevo
distincte de la nôtre (ADR 005 : « notre classification fait foi »).

## Traps & constraints

1. **Le contrat n'a pas de `headers`.** Un pied de page avec lien ne suffit pas à la délivrabilité : `List-Unsubscribe` /
   `List-Unsubscribe-Post` sont attendus des gros fournisseurs pour un envoi de masse. Les ajouter touche `EmailMessage`, **tous** les
   transports (`resend`, `file`, `memory`) et `brevo-transport.test.ts`, qui épingle la forme du corps. Décision de plan.
2. **Un lien de désinscription en GET est un piège.** Les antivirus et clients de messagerie préchargent les liens : un GET qui écrit le refus
   désinscrit des membres à leur insu. Le critère dit « suivre le lien enregistre le refus » ; la lecture littérale est un effet au GET. Voir
   Open questions — à trancher en connaissance de cause (page de confirmation + POST, ou GET idempotent assumé).
3. **Le lien doit être infalsifiable et ne contenir aucune identité en clair.** Aucun précédent de jeton signé dans le code (le seul `createHmac`
   est l'empreinte du limiteur). Identité = `member_profile.id`, **jamais l'email** (AGENTS.md). La route est publique : tenant par Host,
   `withTenant`, **jamais `withRlsBypass`** (point d'arrêt de revue). Secrets dans `@/env`, jamais en paramètre d'association.
4. **Expéditeur global.** `getEmailFrom()` ignore l'association : tous les envois partent d'une adresse de plateforme. Pour une campagne,
   l'identité de l'expéditeur compte (réputation, `Reply-To`). Mémoire projet : expéditeur `zouritestudio.fr` en attendant le domaine du client.
   Ne pas figer d'hypothèse ; décider de `from`/`replyTo` au plan.
5. **`recipientType`.** Une campagne est `'client'` : elle sera **coupée silencieusement** si `EMAIL_ENABLED_FOR_CLIENTS` est faux. Un
   envoi « réussi » sans mail parti est le pire cas : l'écran doit le savoir. À choisir et à tester.
6. **Un désinscrit exclu « au calcul de la cible »** : une seule fonction pure de calcul de cible (membres de l'association, avec email, non
   désinscrits), appelée par le décompte, l'aperçu **et** l'envoi. Sinon le décompte affiché diverge de l'envoi (critère 7). Elle sera **étendue**
   par s27 (cibles) et s27b (nature) : ne pas la disperser.
7. **Décompte distinguant email / sans email** (critère 2) : `mail_only` est générée, donc `COUNT(*) FILTER (WHERE mail_only)` suffit ; un
   membre **sans fiche** n'existe pas dans ce périmètre (la cible est `member_profile`, pas `user`). Un compte sans fiche n'est pas un destinataire.
8. **Isolation entre associations (critère 9).** Toute table nouvelle : `organization_id` + RLS **forcée** + test e2e d'accès croisé entre
   TechCorp (`localhost`) et Marketing Pro (`127.0.0.1`), sous le rôle applicatif. Un oubli de scope ne fuite pas, il ne retourne rien.
9. **`rls-inventory.test.ts`** (leçon de s24) : toute table ajoutée impose de **mettre à jour l'inventaire « Classement RLS » de
   `docs/architecture.md`** (titre, compteur, une ligne par table), sinon 4 tests échouent. À prévoir dans le plan comme fichier touché.
10. **Variables dynamiques.** « parcelle » est **ambiguë** (0, 1 ou plusieurs parcelles actuelles ; une vente ne transfère pas l'historique) ;
    « date » = date d'envoi (`calendarDayOf`, jamais `new Date()` dans un scope `'use cache'`). La détection d'une variable inconnue se fait
    sur le **texte brut composé**, avant envoi ; le rendu **échappe** les valeurs (un nom de fiche est saisi par le bureau ou importé :
    `SCI <b>…`). Le corps libre vient d'un éditeur Markdown : décider ce qui est autorisé en HTML sortant.
11. **Aperçu avec les données d'un destinataire réel** (critère 5) : un aperçu lit une fiche de **cette** association sous `withTenant` ; il ne
    doit ni envoyer ni écrire. Données personnelles à l'écran : pas de `'use cache'`, `<Suspense>`, aucun journal du contenu.
12. **Envoi synchrone dans une Server Action = risque.** Jusqu'à ~400 membres, un envoi unitaire en boucle peut dépasser le délai d'une
    requête ; il n'y a **pas encore de `scheduled_job`** (s26/ADR 006). La story demande de pouvoir « intercepter le déclenchement » : un
    envoi persisté par destinataire (état par ligne) rend s26 additif ; une boucle en mémoire oblige à tout reprendre. Voir Open questions.
13. **Idempotence.** Un double-clic ou une relance ne doit pas envoyer deux fois (s26 le formalise : « jamais deux fois la même campagne »).
    Ici au moins : statut de campagne `brouillon → envoyée` à sens unique, changement conditionnel (précédent : workflow des signalements,
    ADR 028).
14. **Rien en dur (ADR 010).** Mentions légales du pied de page, nom de l'association, adresse de contact, logo : paramètres du tenant. Les
    **4 modèles** sont du contenu de code provisoire (libellés dans `messages/fr.json`) ou des lignes `email_template` par tenant ? L'architecture
    nomme `email_template` et dit que s27b lit la **nature** « dans la configuration du tenant ». Voir Open questions.
15. **Plafond Brevo (300/jour, par compte)** : **hors périmètre** (s26). Mais l'archive ne doit pas prétendre qu'un envoi à plus de 300
    destinataires a abouti ; sans s26, un dépassement échouera côté Brevo après une partie des envois. À documenter dans le plan comme limite
    connue, pas comme anticipation.
16. **`logo` en WebP** : pas d'image dans l'email (repli sur le nom). Le critère 3 dit « en-tête au logo » : acceptable seulement si le logo est
    PNG. Quatrième copie de `pngLogoUrlOf` à éviter : l'extraire serait un changement transverse (hors s25 ?) — à décider.
17. **Données personnelles** : `docs/architecture.md` et s38/s40 — la table de désinscription et l'archive des campagnes entrent dans l'export
    d'association (s38) et la désinscription dans la copie du membre (s40) ; à noter, pas à implémenter ici. Contenu de campagne archivé :
    texte libre du bureau, jamais dans les journaux.
18. **Environnement de travail** (mémoire projet) : `pnpm test --run` seulement ; e2e **jamais en local** (CI) ; pas de `pnpm build` automatique ;
    pre-push lent mais passé ; stager chemin par chemin ; `docs/designs/*.zip` et `docs/logs/` non suivis, étrangers à s25 ; pas de déploiement
    en production avant s46b/s47/s12.
19. **Tests existants à relire** : `brevo-transport.test.ts`, `resend-transport.test.ts`, `file-transport.test.ts`, `get-email-transport.test.ts`,
    `provider-imports.test.ts`, `email-service.test.tsx`, `action-registry-authorization.test.ts`, `rls-inventory.test.ts`, `e2e/tenant-isolation.spec.ts`.

## Open questions

1. **Corps de la requête Brevo et `headers`.** Peut-on passer `List-Unsubscribe` / `List-Unsubscribe-Post` par `/v3/smtp/email` (champ
   `headers`) ? Non vérifié ; à confirmer dans la documentation Brevo avant de modifier `EmailMessage`.
2. **Effet du lien : GET direct ou page de confirmation puis POST ?** Le critère 6 dit « suivre le lien enregistre le refus, le lui confirme
   à l'écran ». À arbitrer avec la contrainte des préchargements (trap 2) — c'est une décision de produit sur un sujet réglementaire.
3. **Forme de l'envoi** : boucle dans la requête, ou campagne persistée avec **une ligne d'envoi par destinataire** (statut, date) traitée par un
   déclencheur interceptable ? La seconde sert aussi s26 (parts, reprise, anti-doublon) et s30 (statistiques) ; elle ajoute une table.
   Complexité 3 vs risque de reprise en s26 : à trancher au plan.
4. **Qui est l'expéditeur, et y a-t-il un `Reply-To`** (adresse de contact de l'association) ? Et la campagne est-elle `'client'` ou
   `'system'` au regard des interrupteurs d'application (trap 5) ?
5. **Mentions du pied de page** : où vivent-elles ? Aucune clé de registre (raison sociale, adresse postale, mentions légales). Ajouter des
   clés au registre de s02 (page « Réglages ») fait partie de s25 ou d'une story à part ? Le critère 3 les exige.
6. **Syntaxe et liste des variables** (`{{nom}}` ? `{nom}` ?), et **valeur de « parcelle »** pour 0 ou plusieurs parcelles (liste jointe ?
   première ? vide ?). Non spécifié par le CDC.
7. **Les 4 modèles** : contenu de code provisoire marqué, ou lignes `email_template` par association (modifiables) ? L'architecture nomme la
   table ; la story n'exige pas l'édition des modèles. Le bureau peut-il modifier un modèle avant l'envoi (oui pour le texte de la campagne, à
   confirmer pour le modèle lui-même) ?
8. **Archive** : que contient exactement « sa cible » ? Le nombre de destinataires (avec/sans email), la liste des fiches au moment de
   l'envoi (donnée personnelle conservée), ou seulement le type de cible (« tous les membres ») ? Lié à l'export (s38) et au droit d'accès.
9. **Désinscription : portée de la clé.** Par fiche (`member_profile.id`), par adresse email, ou les deux ? Un foyer partage une adresse ;
   une adresse change. AGENTS.md interdit l'email comme identité : la lecture sûre est « par fiche », mais deux fiches à la même adresse sont
   impossibles (index unique) — à confirmer.
10. **Ré-inscription** : aucun critère ne la décrit ; le bureau peut-il lever un refus depuis la fiche ? Hypothèse : non en V1 (le refus du
    membre prime) ; à confirmer, car s27b « réintègre » par nature, pas par levée.
11. **Écrans** : emplacement dans la navigation du bureau, forme de l'aperçu (volet, page), de l'archive (liste paginée + détail), de la
    mention sur la fiche, de la page publique. Aucune maquette n'existe : c'est le rôle de `/ks-design s25` (design system existant ; un besoin
    non couvert est un « design system gap »).
12. **Corps libre** : Markdown rendu en HTML d'email (Milkdown est en place pour le CMS) ou texte brut seul ? Le critère de l'habillage ne tranche pas.
13. **Autorisation** : action `campaign.send` seule, ou lecture de l'archive distincte de l'envoi ? Défaut sûr `['owner','board']` partout ;
    s37 réglera par rôle plus tard (précédent `member.role.assign`, `member.note.manage`).
14. **Découpage** : complexité 3 déclarée. Avec une table d'envois par destinataire, une page publique signée, des clés de registre, un gabarit
    commun, 4 modèles, aperçu et archive, la story approche le seuil « trop grosse ». À évaluer au plan : si le plan dépasse une dizaine de tâches,
    proposer la scission (par ex. **désinscription** d'un côté, **composition + envoi** de l'autre) plutôt qu'un plan gonflé.
