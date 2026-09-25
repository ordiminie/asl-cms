---
validated: yes
---

# Plan — Story s08-formulaire-contact

Branch: `feature/s08-formulaire-contact`, à créer depuis `main` **à jour** (voir la note de
numérotation des migrations, tâche 2).

> **Sources** :
>
> - recherche : `docs/research/s08-formulaire-contact.md` ;
> - design validé : `docs/designs/s08-formulaire-contact.md`, maquette
>   `docs/designs/s08-formulaire-contact.html` ;
> - design system : `docs/design-system.md` §1.7, §1.9, §3.1, §3.2, §3.5, §3.9, §5.1 à §5.6 ;
> - décision structurante : **ADR 025**
>   (`docs/decisions/025-messages-du-site-table-dediee.md`) ;
> - règles lues : `rule-architecture`, `rule-safe-server-action`, `rule-form-front-and-back`,
>   `rule-zod-client-server-internationalization`, `rule-service`, `rule-services-tests`,
>   `rule-persistence`, `rule-email-service`, `rule-service-emails-internationalization`,
>   `rule-react-cache-next-cache`, `rule-logger`.

> **Scission du 24/09/2026.** Ce plan comptait neuf tâches pour une story cotée 2. La moitié
> « limitation de débit » est partie dans **s08b-limitation-debit-formulaires** — elle correspond
> exactement à la ligne du PRD « Limitation de débit des formulaires publics », complexité 1, celle que
> s10 réemploie. `docs/stories.md` porte le découpage ; ce plan ne garde que les critères 1 à 4 et les
> tâches qui les servent. Le plan jumeau est `docs/plans/s08b-limitation-debit-formulaires.md`.
>
> **L'ordre est une contrainte, pas une préférence : s08 d'abord, s08b ensuite.** Un limiteur sans
> formulaire ne protège rien, et s08b n'a ni écran ni chemin d'appel tant que `/contact` n'écrit pas.
> Ce que devient le formulaire dans l'intervalle est dit en décision F, sans rien déguiser.

## Target story

**En tant que** visiteur **je veux** envoyer un message au bureau depuis le site **afin de** poser
une question sans avoir de compte. Complexité 2, dépend de s02 et s04 (livrées).

1. Un envoi valide enregistre le message, affiche une confirmation et notifie par email l'adresse
   paramétrée du tenant.
2. Un envoi invalide (email mal formé, message vide) affiche les erreurs **par champ**, n'enregistre
   rien et n'envoie aucun email.
3. Le bureau consulte en back-office la liste des messages reçus, triée par date, avec le détail de
   chaque message.
4. Changer l'adresse de notification dans les paramètres (s02) redirige le message suivant vers la
   nouvelle adresse.

Les trois critères de limitation de débit (seuil horaire, empreinte hachée, purge sous 24 h) sont
ceux de **s08b** et ne sont ni couverts ni testés ici.

### Décisions déjà rendues, non rouvertes ici

- **Champs** : nom (facultatif), email, objet, message. **L'objet reste un `input` de texte libre** —
  la liste d'objets administrable a été écartée avant le brief. La catégorisation est la machinerie
  de s10, le formulaire routé par catégorie celle de s22 : ni l'une ni l'autre n'entre ici.
- **Échec de notification** : le visiteur voit le **même écran de succès** ; le bureau voit
  l'incident dans la liste (badge) et dans le détail (`alert` avec lien vers Réglages).
- **Back-office** : liste triée par date, détail en **page dédiée**, état lu / non lu, **sans
  archivage ni suppression**.
- **Tâches de code héritées du design system** (§1.9, §3.9, §5.2) : `--destructive-text`,
  `--table-stripe` sombre, `--table-row-hover`, et les sept jumelles sombres de `theme.ts`. Elles
  restent dans s08 — c'est la tâche 1. s08b n'en porte aucune.

### Décisions tranchées par ce plan

**A. La table des messages — ADR 025.** Une table `contact_message` dédiée, à champs fixes, sans
jsonb ni colonne d'adresse ; `user_submissions`, son écran SuperAdmin `/admin/submissions`, son seed
et `e2e/tenant-isolation.spec.ts` ne sont pas touchés. Seul l'écrivain change : `/contact` écrit
désormais dans `contact_message`. Conséquence dite, pas cachée : `/admin/submissions` ne reçoit plus
de nouveaux messages de contact.

L'absence de colonne d'adresse est une propriété **de ce plan-ci**, même si le critère qui l'exige
(« aucune adresse IP en clair en base ») est parti dans s08b : s08 supprime le seul endroit du produit
où une IP de visiteur s'écrivait — le `metadata` jsonb de `user_submissions`, alimenté par l'action
actuelle de `/contact`. s08b n'aura donc rien à nettoyer derrière s08 ; il n'aura qu'à ne pas rouvrir
la porte, et le schéma de `contact_message` la lui ferme.

**B. La notification.**

- **`recipientType: 'system'`**. `'admin'` et `'client'` sont **silencieusement coupés** si les lignes
  `email.enabled*` manquent dans `app_settings` (`getBooleanSettingService` rend `false` sans
  erreur) : le critère 1 serait alors faux en production, sans trace. `'system'` ne peut pas être
  coupé. Justification de fond : c'est une notification interne à une adresse de fonction, pas un
  envoi aux membres — les interrupteurs d'envoi de l'association gouvernent les seconds.
- **Adresse de réponse** : **le contrat `EmailTransport` n'est pas touché**. Ajouter `replyTo`
  toucherait l'ADR 005/017 et ses quatre adaptateurs pour un confort que le design résout déjà :
  l'adresse du visiteur est écrite **en clair et en `mailto:`** dans le corps de l'email, dans la
  liste et dans le détail. La story qui aura besoin d'un vrai `Reply-To` (s22) rouvrira le contrat
  avec son propre ADR.
- **Expéditeur** : celui de la plateforme (`getEmailFrom()`) — `sendEmailService` ignore le `from` du
  payload. L'identité de l'association est portée par le **préfixe de l'objet** et par l'en-tête du
  gabarit, conformément à §5.6.
- **Destination lue à l'envoi**, via `getAssociationSettingsService(organizationId)` (sans cache,
  sans autorisation, délibérément — son commentaire nomme déjà s08) : c'est ce qui tient le critère 4,
  « le message **suivant** ».

**C. Ordre de traitement de la soumission** : validation Zod → écriture → notification. Une
soumission invalide ne coûte ni écriture ni email (critère 2), et un échec de notification ne fait pas
échouer l'écriture (critère 1 + design).

**s08b insère une seule étape, entre la validation et l'écriture** : la consommation du quota. Le
motif de cette place est déjà tranché et il appartient au plan de s08b — seule une soumission **bien
formée** consomme du quota, pour qu'un visiteur qui corrige une faute de frappe ne se fasse pas
couper. Ce plan-ci doit seulement **laisser la place** : l'action de la tâche 5 enchaîne ses étapes
dans une fonction lisible, où insérer un appel entre deux lignes ne demande pas de réécriture.

**D. Longueur du message** : **non vide après `trim`**, plafond 5 000. Le `min(10)` actuel refuse
« Bonjour ? » avec un message de longueur, alors que le critère ne parle que de « message vide » et
que le design n'écrit qu'une phrase, « Écrivez votre message avant de l'envoyer. ». Pas de compteur de
caractères : §3.9 en fixe la forme, mais le design n'en dessine pas.

**E. Marquage « lu »** : la page de détail **ne mute pas pendant son rendu**. Un petit composant
client appelle une Server Action idempotente au montage ; « Marquer comme non lu » est un bouton
`outline`. C'est ce que le design demande (« Marqué comme lu à l'ouverture ») sans écrire dans une
fonction de rendu.

**F. Ce que devient le formulaire tant que s08b n'est pas livrée — dit franchement.** L'action
actuelle porte un limiteur `RateLimiterMemory` ; la tâche 5 réécrit l'action entièrement et **ce
limiteur disparaît sans remplaçant immédiat**. Entre le merge de s08 et celui de s08b, `/contact`
existe donc **sans aucune limitation de débit**.

- **Pourquoi ne pas garder `RateLimiterMemory` en attendant** : il compte en mémoire de processus,
  donc il repart à zéro à chaque redémarrage et ignore les autres instances ; il n'est ni par
  association ni paramétrable ; et il est la raison pour laquelle l'IP transitait jusqu'ici en clair.
  Le conserver, ce serait écrire une protection que s08b supprime aussitôt, au prix d'un faux
  sentiment de sécurité dans l'intervalle et d'un diff de suppression dans la story suivante.
- **Pourquoi c'est acceptable** : le garde-fou n'est pas dans s08, il est dans le graphe de
  dépendances. **s12b (mise en ligne) dépend de s08b**, `docs/stories.md` le dit : le site ne peut pas
  être publié tant que le limiteur n'est pas livré. La fenêtre sans protection est donc une fenêtre de
  **développement**, sur un site qui n'est pas encore public et où aucune adresse réelle ne passe.
- **Ce qui rendrait la réponse fausse** : mettre `/contact` en ligne — même sur une préproduction
  ouverte au public, même « juste pour montrer » — avant s08b. Si cela devient nécessaire, ce n'est
  pas `RateLimiterMemory` qu'il faut ressusciter, c'est s08b qu'il faut livrer : elle est cotée 1.

**G. Hors périmètre, dit et non comblé** : archivage, suppression, recherche, filtres, tri par
colonne, sélection multiple, accusé de réception au visiteur, mention RGPD (aucune durée de rétention
n'est décidée), lien vers `/contact` ailleurs que dans le pied de page écrit à la main (le menu de
s04b ne pointe que vers des pages CMS), retrait ou renommage de `/admin/submissions`. Le champ piège
anti-spam et le limiteur en mémoire du blog hérité relèvent de s08b, qui les traite dans son propre
hors-périmètre.

## Tasks (ordered)

1. [x] **Les dettes du design system que s08 porte** (§1.9, §3.9, §5.2).
   - `src/app/globals.css` : **le token existe déjà sous un autre nom**. `--destructive-ink` tient
     exactement le rôle de `--destructive-text` (clair `var(--destructive)`, sombre
     `oklch(0.74 0.16 27)`) et il est **consommé par `src/components/ui/form.tsx`**
     (`FormLabel`, `FormMessage`). Ce n'est donc **pas un ajout mais un alignement** : renommer en
     `--destructive-text`, poser les valeurs tranchées par le design system — clair
     `oklch(0.48 0.17 27)`, sombre `oklch(0.68 0.17 27)` au lieu du `0.74 0.16 27` en place —,
     mettre à jour la correspondance `@theme` (`--color-destructive-text`) et les **deux**
     occurrences de `text-destructive-ink` dans `form.tsx`. `grep -rn "destructive-ink" src/` doit ne
     plus rien rendre.
   - `--table-stripe` (clair `oklch(0.99 0.002 250)`, **sombre `oklch(0.235 0.009 255)`**) et
     `--table-row-hover` (clair `= var(--muted)`, sombre `oklch(0.29 0.012 250)`), avec leur
     correspondance `@theme`, puis **appliqués dans `src/components/ui/table.tsx`** sur `TableRow`.
     Le design system le dit : ces deux tokens servent **tous** les tableaux du bureau. Conséquence
     voulue, à annoncer dans le PR : la liste des actualités de s05 et les écrans SuperAdmin
     gagnent la zébrure et le survol en même temps.
   - `src/lib/emails/theme.ts` : les **sept jumelles sombres** de §5.2
     (`background #171A1E`, `text #E8EBEF`, `textMuted #9DA6AE`, `rule #32363A`,
     `buttonBg #2063B0`, `buttonText #FFFFFF`, `link #8CC3FC`), exposées en `EMAIL_COLORS_DARK`, et
     un utilitaire qui rend le bloc `<style>` servant ces valeurs sous
     `@media (prefers-color-scheme: dark)` **et** `[data-ogsc]`. Le libellé du bouton reste
     `#FFFFFF` **forcé** (`color:#ffffff !important`), et le bouton **toujours doublé de l'URL en
     clair**. Aucune couleur n'est retapée dans un gabarit.
   - **Si une branche parallèle (s06, s07, s09) a déjà posé l'un de ces tokens**, ne pas le
     redéclarer : la tâche est « ces tokens sont présents et justes », pas « ajouter des lignes ».
   - **Tests** : un test de tokens qui vérifie que `--destructive-text`, `--table-stripe` et
     `--table-row-hover` sont déclarés en clair **et** en sombre dans `globals.css`, et que
     `EMAIL_COLORS_DARK` porte les sept clés aux valeurs de §5.2 ; le rendu du gabarit (tâche 4)
     contient la règle `prefers-color-scheme: dark` et le sélecteur `[data-ogsc]`.

2. [x] **Table `contact_message`, RLS, registre d'actions, types de domaine** (ADR 025).
   - `src/db/models/contact-message-model.ts` : colonnes de l'ADR 025 — `organization_id` **`NOT
NULL`** en `cascade`, `sender_name` nullable, `sender_email`, `subject`, `body`, `read`,
     `notification_failed`, `created_at` —, index `(organization_id, created_at desc)`. **Ni jsonb,
     ni colonne d'adresse.** Enregistré dans `src/db/models/db.ts`.
   - Migration du modèle par `pnpm db:generate`, **puis** policy par
     `drizzle-kit generate --custom` sur le patron `0017_news_rls.sql` : `ENABLE` + `FORCE`,
     `tenant_isolation`. Jamais de SQL ni de journal écrits à la main.
   - ⚠️ **Rebaser sur `main` à jour avant de générer.** La dernière migration du dépôt est
     `0017_news_rls.sql` : **s06, s07 et s09 génèrent chacune une `0018`**, et le journal Drizzle
     (`drizzle/migrations/meta/_journal.json`) ni ses instantanés ne se fusionnent à la main
     (AGENTS.md l'interdit). Brancher depuis un `main` à jour, ou **régénérer** après rebase — jamais
     recoudre. s08b générera à son tour ses migrations **par-dessus** celles-ci, sur la même règle.
   - `ActionIdConst.CONTACT_MESSAGE_READ = 'contact.message.read'` et son entrée dans
     `ACTION_REGISTRY`, rôles `['owner', 'board']`. Le nom dit ce qu'il accorde : le bureau consulte
     et bascule le témoin lu / non lu, il ne crée, ne modifie ni ne supprime aucun message.
     **`canManageUserSubmissions` n'est pas élargi** — il garde l'écran SuperAdmin et le spec
     d'isolation de s01.
   - `src/services/types/domain/contact-message-types.ts` : DTO, résultats de soumission, constantes
     d'affichage `CONTACT_MESSAGES_BUREAU_PAGE_SIZE = 25`. **Écrit sans importer le modèle Drizzle**
     (`rule-architecture` ; c'est le défaut relevé sur `user-submission-types.ts`).
   - **Tests** : l'entrée `contact.message.read` autorise `owner` et `board`, refuse `member` et un
     utilisateur hors association ; `pnpm db:generate` ne produit plus de diff après la migration ;
     la garde `src/db/models/rls-inventory.test.ts` passe avec `contact_message` classée « scopée ».

3. [x] **Persistance, service et DAL des messages** (ADR 025).
   - `src/services/validation/contact-message-validation.ts` : schéma de service — nom facultatif
     ≤ 120, email valide, objet 3-255, corps **non vide après `trim`** et ≤ 5 000, identifiants UUID,
     numéro de page entier ≥ 1.
   - `src/db/repositories/contact-message-repository.ts`, **toujours `getDb()`** : création, lecture
     par id, liste paginée `created_at desc, id desc` (départage stable), compte des non lus, bascule
     du témoin lu, marquage `notification_failed`.
   - `src/services/contact-message-service.ts` :
     - `createContactMessageService({organizationId, locale, name?, email, subject, body})` —
       `safeParse` → `withTenant` → écriture → **tentative de notification** (tâche 4) → en cas
       d'échec, `withTenant` → `notification_failed = true` + `logger.error`, et **la soumission
       reste un succès**. **Sans contrôle d'autorisation, et c'est délibéré** : l'auteur est un
       visiteur anonyme ; le commentaire le dit, sur le patron de
       `consumeMagicLinkRequestQuotaService`. L'email part par **un appel de service direct**, jamais
       par une façade — c'est le défaut de `rule-architecture` relevé dans
       `user-submission-service.ts`, à ne pas reproduire.
     - **Le service ne reçoit jamais d'adresse IP**, et sa signature n'en prévoit aucune : s08b n'aura
       pas à l'élargir, son quota se consomme dans l'action, en amont.
     - `getContactMessagesPageService`, `getContactMessageService`,
       `setContactMessageReadService(id, read)` — chacun `canPerformAction(user, organizationId,
CONTACT_MESSAGE_READ)` avant tout accès, `AuthorizationError` sinon.
     - Façade + intercepteur avec `shouldLogDetails: () => false` (le corps d'un message est une
       donnée personnelle).
   - `src/app/dal/contact-message-dal.ts` : `cache()` + `withCurrentTenant`, **sans `'use cache'`** —
     donnée d'administration, derrière `<Suspense>`, sur le patron de `user-submission-dal.ts` ;
     `canManageCurrentContactMessagesDal` pour l'affichage.
   - **Tests** (`src/services/__tests__/contact-message-service.test.ts`, repositories mockés,
     `rule-services-tests`) :
     - `[PUBLIC]` (visiteur anonyme) **peut créer** — c'est le chemin de la story — mais ne peut ni
       lire la liste ni ouvrir un message ;
     - `[ORGANIZATION OWNER]` et `[ORGANIZATION ADMIN]` (bureau) lisent et basculent le témoin ;
     - `[ORGANIZATION MEMBER]`, `[USER NOT IN ORGANIZATION]` et `[USER]` sans association →
       `AuthorizationError`, **et aucun DAO appelé** ;
     - validation : email mal formé, corps vide ou fait d'espaces, objet trop court → rejet **sans
       écriture ni envoi** (critère 2) ;
     - un échec de transport laisse le message écrit, marque `notification_failed` et **ne fait pas
       échouer** la création (critère 1 + design) ;
     - la liste est rendue `created_at desc`.

4. [x] **L'email de notification au bureau** (design écran 4, §5.1 à §5.6).
   - `src/lib/emails/contact-message-email.tsx`, sur le patron de `magic-link-email.tsx` : 600 px,
     tables imbriquées, styles en ligne, `Georgia, serif` / `Helvetica, Arial, sans-serif`, corps
     17 px / 1,6, titre 24 px. En-tête à monogramme + nom de l'association sur `accent` /
     `accent-solid` de la teinte du tenant (`getEmailAccent`), titre, **table de deux colonnes** (De ·
     Adresse email en `mailto:` **écrite en clair** · Objet · Reçu le), le message dans un encart
     `muted` bordé avec les retours à la ligne conservés, **un bouton en table de 48 px doublé de
     l'URL en clair** vers `/bureau/messages/{id}`, et un pied `muted` / `muted-foreground` qui dit
     **pourquoi l'email arrive**, sans lien de désinscription. **Locale explicite en prop**, `<Html
lang={locale}>`. Couleurs **uniquement** depuis `theme.ts` (tâche 1), bloc sombre servi par
     `prefers-color-scheme` **et** `[data-ogsc]`.
   - `sendContactMessageNotificationEmailService` dans `src/services/email-service.ts` :
     `getTranslations({locale, namespace: 'email.contact.notification'})`, **version texte complète**
     avec l'URL en clair, `sendEmailService(..., {recipientType: 'system'})` (décision B). Objet
     préfixé du nom de l'association, **60 caractères au plus**, pré-en-tête de 90 caractères qui
     complète l'objet sans le répéter (§5.6).
   - Libellés sous `email.contact.notification` dans `messages/fr.json`.
   - **Locale explicite de bout en bout** : la page fournit `useLocale()`, l'action la passe par
     `resolveSupportedLocale(formData.get('locale'))`, le service **et** le gabarit reçoivent la même
     (`rule-service-emails-internationalization` ; le cookie `NEXT_LOCALE` est absent d'un navigateur
     neuf — le bogue attrapé en s03).
   - **Tests** : le rendu contient l'adresse du visiteur en `mailto:`, l'URL du back-office **en
     clair** sous le bouton, aucune couleur écrite hors `theme.ts` (grep de `#` dans le gabarit), le
     bloc sombre et son `[data-ogsc]` ; l'objet fait ≤ 60 caractères et commence par le nom de
     l'association ; le service passe `recipientType: 'system'` et une version texte non vide ;
     l'adresse de destination vient des paramètres du tenant, **jamais de `env.EMAIL_TO`**
     (critère 4) ; un `EmailTransportError` remonte au service appelant, il n'est pas avalé sur place.

5. [x] **Le formulaire public `/contact`, refait** (design écran 1, quatre de ses cinq états).
   - `contact-form-validation.ts` : ajouter `name` facultatif, garder le patron
     `createContactFormSchema(t)` par `extend` (`rule-zod-client-server-internationalization`),
     appliquer la décision D sur la longueur du message.
   - `actions.ts` : remplacer entièrement `submitContactAction`. `RateLimiterMemory` et l'écriture de
     l'IP en clair **disparaissent** (décision F : la protection revient avec s08b, pas avant).
     Nouvelle forme, sur le précédent d'action publique `requestMagicLinkAction` :
     `{status: 'invalid' | 'sent', errors?: {field, message}[]}`. **Le membre `'rate_limited'` et son
     `limit?: number` sont ajoutés par s08b** — ne pas les préparer à vide ici, un état qu'aucun
     chemin ne produit est un état non testable. Enchaînement de la décision C : résolution du tenant
     (`getCurrentTenantDal`) → **validation par le schéma partagé** (plus aucune regex à la main) →
     façade du service des messages. Pas de `requireActionAuth()` : l'action est publique et le
     commentaire le dit (`rule-safe-server-action`, précédent `requestMagicLinkAction`).
   - `contact-form.tsx` : les quatre états qui restent du design. **La carte de succès verte
     disparaît** — `alert` **neutre** ancré (`role="status"`, `CircleCheck` 20 px en `primary`, fond
     `card`), aucun vert, aucun toast, et un bouton `outline` « Écrire un autre message ». Erreurs :
     **les trois signaux ensemble** (§3.1, §3.9) — résumé `alert` `destructive` **bordure 2 px**,
     `role="alert"`, `tabindex="-1"` **cible de focus à la soumission en desktop comme en mobile**,
     titre en 700, liste de liens d'ancrage ; bordure 2 px sur les champs fautifs ; message
     **16 px / 500** en `--destructive-text` sous chaque champ. Chargement : libellé remplacé,
     **largeur conservée**, aucun `skeleton`. Champ caché `locale`. **Le cinquième état, le refus au
     seuil, est livré par s08b** avec le limiteur qui le produit.
   - Écarts du design **délibérément non reproduits** (ils sont listés dans le document de design) :
     l'ordre aide / erreur suit le composant du socle (`FormDescription` puis `FormMessage`), le
     souligné pointillé du « 3 » est un marqueur de maquette, les icônes `Mail` et `Send` sortent
     (hors vocabulaire §1.7). **Point d'attention** : `FormMessage` rend `text-sm` (14 px) là où
     §3.9 veut 16 px / 500 ; s08 **corrige au point d'appel**, pas dans `src/components/ui/form.tsx`
     — aligner le composant du socle change tous les formulaires du produit et ne relève pas de cette
     story. À signaler comme dette du socle dans le PR.
   - `messages/fr.json`, namespace `ContactPage` : titres, aide, messages de validation par champ,
     succès. Les clés devenues mortes (`errors.allFieldsRequired`, `errors.subjectRange`,
     `errors.contentRange`, `errors.rateLimit` à l'ancienne forme) sont retirées — **y compris
     `errors.rateLimit`** : s08b écrit la sienne, à sa forme, avec le seuil interpolé. `fr` seule
     (ADR 008).
   - `page.tsx` reste `'use cache'` + `cacheLife('max')` : **ni tenant, ni `headers()`, ni horloge**
     n'y entrent (`rule-react-cache-next-cache`). Tout ce qui dépend de la requête vit dans l'action.
   - **Tests** (jsdom + test d'action, façades mockées) : erreur par champ rendue sous le bon champ et
     liée par l'ancre du résumé ; le résumé prend le focus à la soumission ; succès = `alert` neutre
     sans classe verte ; l'action rejette un email mal formé **sans appeler la façade d'écriture** ;
     la locale part bien du formulaire.

6. [x] **Back-office « Messages reçus »** (design écrans 2 et 3).
   - `src/app/[locale]/(bureau)/bureau/messages/page.tsx` et `…/[id]/page.tsx`, derrière
     `<Suspense>`, avec le contrôle d'accès répété (`Promise.all([requireCurrentTenantDal(),
canManageCurrentContactMessagesDal()])` → `<BureauAccessDenied />`), sur le patron de
     `bureau/pages/page.tsx`.
   - Liste : `h1` « Messages reçus », ligne `meta` du nombre de non lus, **aucun bouton `default`**,
     `table` dans une `card` trié `created_at desc`, colonnes Objet (600 si non lu) · De (nom puis
     adresse en `meta`, adresse seule sans nom) · Reçu le en `data` (`font-mono`, `tabular-nums`) ·
     État · Action (« Ouvrir le message », écrit, jamais une icône seule). **Les deux badges sur une
     seule ligne**, `gap` 8 px, retour à la ligne permis, **ligne à 56 px** : c'est §3.9 qui tranche,
     la variante empilée de la maquette (écart 11) est **écartée**. Pas d'`aria-sort` sur « Reçu le »
     (écart 8 : le tri est fixe, pas une commande). Pagination écrite, 25 lignes ; cartes empilées
     sous 640 px, paires libellé / valeur **dans l'ordre des colonnes** (§3.5). **Écart assumé au
     §3.5 : 25 cartes par page, pas 10.** La pagination est faite côté serveur, qui ignore la
     largeur de l'écran ; la page mobile reprend donc la page de 25 du tableau. Arbitrage de
     l'utilisatrice du 25/09 : une boîte qui reçoit quelques messages par semaine dépasse rarement
     une page, un découpage client ou une taille de page dans l'URL coûterait plus qu'il ne rend.
     Le §3.5 reste la règle pour les autres écrans. État
     vide avec son action (« Voir la page Contact du site »), `skeleton` sur les lignes au chargement.
   - Détail : colonne `max-w-[68ch]`, « ← Messages reçus », `h1` = l'objet, `meta` de la date en
     clair, bloc expéditeur entre deux filets avec l'adresse en `mailto:`, le message avec les
     **retours à la ligne conservés** et sans troncature. Si `notification_failed` : `alert`
     `destructive` **au-dessus de l'expéditeur**, dans la forme complète du §3.2 (ce qui s'est passé,
     **ce qui est perdu — rien**, l'action suivante) et son lien « Ouvrir les Réglages ». Une seule
     action, « Marquer comme non lu » en `outline`, plus la ligne `meta` « Marqué comme lu à
     l'ouverture. ». **Ni suppression, ni archivage.**
   - Marquage lu : composant client monté sur la page de détail, qui appelle une Server Action
     idempotente au montage (décision E) ; l'action et sa jumelle « non lu » appellent
     `requireActionAuth()` puis la façade, et rafraîchissent la liste.
   - Barre latérale : entrée « Messages reçus » dans `NAV_GROUPS`, groupe « Le site », **après
     Navigation** ; l'ordre définitif entre les entrées ajoutées en parallèle par s05, s06, s07 et s09
     se règle à l'intégration. Libellés dans `messages/fr.json`
     (`BureauContactMessagesPage`, `BureauIdentityPage.nav.messages`).
     ⚠️ **Point d'arbitrage, voir plus bas** : icône `Inbox` ou pas d'icône.
   - **Tests** (jsdom, DAL mocké) : ordre rendu = ordre reçu ; état vide avec son lien ; les deux
     badges présents **sur une même ligne** pour un message non lu dont la notification a échoué ;
     l'action « Ouvrir le message » est écrite, une seule par ligne ; le détail conserve les retours à
     la ligne ; l'`alert` d'échec n'apparaît que si `notification_failed` ; un membre simple obtient
     `<BureauAccessDenied />` ; les Server Actions refusent sans le rôle et rafraîchissent après
     succès seulement.

7. [x] **Preuve e2e du formulaire et du back-office, documentation d'architecture.**
   - `e2e/contact.spec.ts`, sur le patron de `e2e/page-cms.spec.ts` et `e2e/magic-link.spec.ts`
     (tenants A et B, mêmes comptes, boîte de sortie `file`, SQL direct).
     - **Critère 1** : un envoi valide depuis A affiche le succès ancré, la ligne paraît en tête de
       `/bureau/messages` sur A, son détail montre le corps, et **un email est déposé dans la boîte de
       sortie**, adressé à `contact.email` de A.
     - **Critère 4** : changer l'adresse dans « Réglages », renvoyer un message, **le nouvel email
       part vers la nouvelle adresse** (et le précédent vers l'ancienne).
     - **Critère 2** : email mal formé + message vide → erreurs sous les champs, résumé ancré,
       **aucune ligne de plus** en SQL et **aucun fichier de plus** dans la boîte de sortie.
     - **Critère 3** : la liste du bureau est triée par date, le détail ouvre le bon message, et le
       témoin passe à « lu » à l'ouverture puis revient à « non lu » par le bouton.
     - **Isolation** : le message de A est absent de `/bureau/messages` sur B, et la RLS refuse de le
       lire depuis le scope de B en SQL direct sous le rôle applicatif.
     - ⚠️ **Le contexte navigateur porte dès maintenant `extraHTTPHeaders:
{'x-forwarded-for': '203.0.113.7'}`**, bien qu'aucun limiteur ne le lise encore. Motif : ce spec
       envoie plusieurs messages valides d'affilée ; dès que s08b posera son seuil (défaut 3 par
       heure), tous les envois partageraient `127.0.0.1` et le spec se couperait lui-même au
       quatrième. Poser l'en-tête ici coûte une ligne et évite à s08b de rouvrir un fichier qui n'est
       pas le sien.
   - `docs/architecture.md` :
     - `contact_message` ajoutée aux tables scopées, avec sa policy. **Ne pas recopier un décompte de
       table depuis ce plan** : s06, s07 et s09 en ajoutent peut-être en parallèle — recompter, la
       garde `rls-inventory.test.ts` le vérifie.
     - le paragraphe l. 403-407 qui décrit `RateLimiterMemory` avec l'IP en clair dans
       `contact/actions.ts` : **corrigé, pas réécrit au passé**. L'action ne porte plus ni limiteur ni
       IP, c'est vrai dès s08 et il faut le dire ; mais la protection annoncée par le PRD
       (« empreinte hachée, purgée sous 24 h ») **arrive avec s08b**, et le paragraphe doit le nommer
       ainsi plutôt que de laisser croire qu'elle existe. Sa réécriture définitive appartient à s08b.
   - `docs/design-system.md` §5.4 : ajouter la **quatrième nature d'envoi**, « notification interne au
     bureau » (manque n° 3 du design, resté ouvert — c'est une règle écrite, pas une planche), avec le
     pied de forme transactionnelle que la maquette propose.
   - **Vérifié par** `pnpm check:rules` et par la revue ; les tâches 1 à 6 échouent si le code
     contredit ces documents.

## Files touched

**Créés**

- persistance : `src/db/models/contact-message-model.ts`,
  `src/db/repositories/contact-message-repository.ts`, migrations `drizzle/migrations/00NN_*.sql`
  (modèle `contact_message` générée, policy `contact_message` en `--custom`) et leurs instantanés ;
- domaine et services : `src/services/types/domain/contact-message-types.ts`,
  `src/services/validation/contact-message-validation.ts`,
  `src/services/contact-message-service.ts`,
  `src/services/facades/contact-message-service-facade.ts` et son intercepteur,
  `src/services/__tests__/contact-message-service.test.ts` ;
- DAL et écrans : `src/app/dal/contact-message-dal.ts` (+ test),
  `src/app/[locale]/(bureau)/bureau/messages/page.tsx`, `…/[id]/page.tsx`, `…/actions.ts` (+ test),
  `src/components/features/contact/contact-message-list.tsx`,
  `contact-message-detail.tsx`, `mark-read-on-open.tsx` (+ tests) ;
- email : `src/lib/emails/contact-message-email.tsx` (+ test) ;
- e2e : `e2e/contact.spec.ts` ;
- **documents de la story** : `docs/research/s08-formulaire-contact.md`,
  `docs/designs/s08-formulaire-contact{-brief.md,.md,.html}`, `docs/plans/s08-formulaire-contact.md`,
  `docs/decisions/025-messages-du-site-table-dediee.md`.

**Modifiés**

- `src/app/globals.css`, `src/components/ui/table.tsx`, `src/components/ui/form.tsx` (renommage du
  token), `src/lib/emails/theme.ts` ;
- `src/db/models/db.ts` ;
- `src/services/email-service.ts`, `src/services/types/domain/action-registry-types.ts` ;
- `src/app/[locale]/(public)/contact/{actions.ts,contact-form.tsx,contact-form-validation.ts}`
  (+ `actions.test.ts`, réécrit) ;
- `src/components/features/association/bureau-sidebar.tsx`, `messages/fr.json` ;
- `docs/architecture.md`, `docs/design-system.md` (§5.4).

**Explicitement non touchés**

- **ADR 025** : `src/db/models/user-submission-model.ts`,
  `src/db/repositories/user-submission-repository.ts`, `src/services/user-submission-service.ts` et sa
  façade, `src/app/dal/user-submission-dal.ts`, `src/app/[locale]/admin/submissions/**`,
  `src/components/features/admin/submissions/**`, `src/components/features/quick-feedback-action.ts`,
  `src/db/scripts/seed.ts`, `e2e/tenant-isolation.spec.ts`.
- **Réservés à s08b** : `src/db/models/rate-limit-model.ts`,
  `src/db/repositories/rate-limit-repository.ts` et son test, `src/services/rate-limit-service.ts` et
  son test, `src/services/facades/rate-limit-service-facade.ts`,
  `src/db/repositories/organization-repository.ts`,
  `src/services/types/domain/association-settings-types.ts`,
  `src/db/scripts/tenant-settings-seed.ts` et son test, et le limiteur en mémoire du blog hérité
  (`(public)/blog/[slug]/actions.ts`). **Aucun de ces fichiers n'entre dans le diff de s08** : c'est
  ce qui rend les deux PR lisibles séparément.

## Test strategy

- **Unitaire (Vitest, `pnpm test --run` — jamais `pnpm test` seul, qui reste en mode veille)** :
  service des messages avec repositories mockés, les trois rôles globaux plus les rôles d'association
  (`rule-services-tests`), ordre validation → autorisation → écriture ; schémas Zod partagés
  client / serveur ; composants jsdom pour les quatre états du formulaire et les deux écrans du
  bureau ; rendu du gabarit email ; tokens déclarés en clair et en sombre.
- **e2e (Playwright, contre le **build de production**, base éphémère seedée)** : les quatre critères
  de bout en bout, plus l'accès croisé entre deux associations — la RLS n'est prouvable que là
  (`db.ts` refuse toute connexion en test unitaire).
- **Non-régression** : `e2e/tenant-isolation.spec.ts`, `e2e/association-settings.spec.ts`,
  `user-submission-service.test.ts`, `user-submission-dal.test.ts` restent verts sans modification —
  ADR 025 garantit qu'aucun de leurs fichiers n'est touché. Les suites du limiteur de s03 ne sont pas
  touchées non plus : elles changeront dans s08b.
- `pnpm lint`, `pnpm tsc --noEmit` (supprimer `.next/types/routes.d.ts` si `tsc` ne se plaint que de
  `.next/`), `pnpm check:rules`. **Pas de `pnpm build` automatique** (AGENTS.md), sauf pour servir
  l'e2e.

## Definition of Done

- Un commit de story sur `feature/s08-formulaire-contact`, portant la recherche, le design, le plan,
  l'ADR 025 et le code ; un second commit **seulement** pour la migration, si l'implémenteur juge
  utile de pouvoir la révoquer seule.
- Les **quatre** critères de s08 sont couverts par des tests verts, unitaires **et**
  `e2e/contact.spec.ts`. Les trois critères de limitation de débit ne sont pas traités ici et leur
  absence n'est pas un défaut de cette story.
- RLS forcée sur `contact_message`, avec preuve d'accès croisé en e2e ; classement RLS de
  `docs/architecture.md` à jour et garde `rls-inventory.test.ts` verte.
- **Plus aucune adresse IP écrite en base par le formulaire** : l'écriture dans le `metadata` jsonb de
  `user_submissions` disparaît avec l'action réécrite, et `contact_message` n'a aucune colonne où
  l'écrire.
- L'action `contact.message.read` est déclarée au registre ; `canManageUserSubmissions` est inchangé.
- Aucune valeur métier en dur : adresse de notification en paramètre d'association (ADR 010) ;
  libellés dans `messages/fr.json`.
- Tout email part par `sendEmailService` → `getEmailTransport()`, jamais par un transport instancié à
  la main (invariant du budget quotidien de s26).
- **Aucun fichier du limiteur dans le diff** (liste ci-dessus) : si l'implémenteur en ouvre un, c'est
  que la frontière avec s08b a bougé et il faut le dire, pas le faire en passant.
- Aucune régression sur `user_submissions`, sur le spec d'isolation de s01, ni sur le quota de lien de
  connexion de s03. Lint et types propres.
- Revue `/ks-review` passée : `Ship allowed: yes`.

## Points à arbitrer avant validation

1. **Icône de l'entrée « Messages reçus » — le document de design se contredit.** L'écran 0 écrit
   « sans icône » ; le manque n° 6, tranché, écrit « l'entrée la prend, à 20 px » (`Inbox`, §1.7).
   Or **la barre latérale du bureau ne porte aujourd'hui aucune icône** sur ses cinq entrées.
   _Proposition du plan_ : pas d'icône dans la barre latérale (une seule entrée sur six illustrée est
   pire que zéro), et `Inbox` retenue comme l'icône du produit pour « messages reçus » partout
   ailleurs. À confirmer, ou à renverser en illustrant toute la barre — ce qui serait une tâche
   transverse, pas s08.
2. **Zébrure et survol appliqués au composant `ui/table.tsx` partagé.** C'est ce que le design system
   demande (« ces tokens servent tous les tableaux du bureau »), mais cela **change l'apparence de la
   liste des actualités de s05 et des écrans SuperAdmin dans le diff de s08**. À confirmer, ou à
   restreindre au seul tableau de s08 — au prix d'une divergence à rattraper ensuite.
3. **`--destructive-ink` renommé en `--destructive-text`.** Le token existe déjà sous ce nom, avec une
   valeur sombre `oklch(0.74 0.16 27)` au lieu du `0.68` validé par le design system, et il est
   consommé par `src/components/ui/form.tsx` (2 points d'appel) ; `--primary-ink` reste, lui, en
   `-ink`, d'où une asymétrie de nommage. _Proposition_ : renommer et aligner la valeur, suivre le
   design system, et signaler `--primary-ink` comme manque à traiter ailleurs. Variante possible si le
   renommage inquiète pendant que trois branches vivent : garder `--destructive-ink` en alias.
4. **`recipientType: 'system'` pour la notification.** C'est le seul niveau que les réglages
   `email.enabled*` ne peuvent pas couper en silence, donc le seul qui tienne le critère 1 ; en
   contrepartie, un bureau qui coupe ses envois recevra quand même ces notifications.
5. **La fenêtre sans limiteur, ouverte par la scission** (décision F). Entre s08 et s08b, `/contact`
   n'a aucune limitation de débit, et `RateLimiterMemory` n'est pas conservé en attendant.
   _Proposition_ : accepter, parce que s12b (mise en ligne) dépend de s08b et interdit donc de publier
   le site dans cet intervalle. À confirmer explicitement — c'est la seule conséquence de la scission
   que le découpage des stories ne dit pas à voix haute.
