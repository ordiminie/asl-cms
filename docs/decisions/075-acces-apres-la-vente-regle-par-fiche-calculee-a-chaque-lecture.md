# ADR 075 — Accès après la vente : une règle par fiche, calculée à chaque lecture de session

- Status: accepted
- Date: 2026-11-26
- Scope: story s57-acces-ancien-proprietaire
- Complète : [ADR 038](038-acces-ferme-controle-a-chaque-lecture-de-session.md) (accès fermé refusé à
  chaque lecture de session), [ADR 034](034-connexion-limitee-a-l-association-du-domaine.md) (règle
  unique d'ouverture de session), [ADR 029](029-propriete-datee-des-parcelles.md) (périodes datées
  demi-ouvertes), [ADR 054](054-lien-fiche-compte-par-table-de-liaison.md) (lien fiche ↔ compte),
  [ADR 059](059-factures-membres-modele-et-contrat-de-facturation.md) §3 et
  [ADR 073](073-documents-nominatifs-dossier-par-fiche-et-triple-controle.md) §7 (visibilité des factures
  et documents d'un vendeur renvoyée à s57), [ADR 010](010-parametres-et-modules-par-tenant.md) (rien en dur)

## Context

s57 ferme l'accès d'un ancien propriétaire `délai` après la fin de sa dernière période de propriété, sans
rien supprimer, et le rouvre seul en cas de rachat. Arbitrages du 26/11/2026 : la règle est **par
fiche** ; le délai est un paramètre du tenant **en mois** (seed 6), modifiable par le SuperAdmin seul,
**calculé à la volée** (un changement s'applique rétroactivement).

Ce qui existe :

- `canOpenSessionOn(user, organization)` (`src/lib/better-auth/association-membership.ts`) est la règle
  unique d'ouverture **et** de lecture de session (ADR 034, 038) : pure, synchrone, elle ne lit que le
  rôle global et les lignes `member`. Quatre appelants : `getAuthUser`, le hook
  `session.create.before`, `sendMagicLink`, `issueInvitation`. `auth.ts` l'importe : tout import de
  service doit y rester dynamique (`magic-link-integration-imports.test.ts`).
- « Propriétaire » = une période `ends_on IS NULL` ; aucune colonne « propriétaire actuel » ;
  `ends_on` est le jour de la vente, jamais postérieur à aujourd'hui, immuable une fois posé (ADR 029).
- « Mes fiches » (`getMemberProfilesByUserIdDao`, `getMyMemberProfiles`) sert à la fois l'espace membre
  et des lecteurs du bureau (« Ce compte réunit aussi », détenteur d'une adresse partagée, traces de
  rôle).
- Le critère 3 exige un contrôle à chaque lecture de session, sans tâche planifiée.

Trois questions de structure : où vit la condition, ce qu'on stocke, et à quel niveau on écarte une fiche.

## Decision

1. **Règle pure par fiche** (`src/services/rules/member-profile-access-rules.ts`) : à partir des périodes
   d'une fiche, du délai `N` (mois) et du jour calendaire de Paris `today`, l'état de la fiche est :
   - `out_of_rule` — aucune période (fiche jamais rattachée) : accès comme aujourd'hui ;
   - `owner` — au moins une période ouverte ;
   - `grace` — toutes closes, `today < closesOn` ;
   - `closed` — toutes closes, `today >= closesOn` ;

   avec `soldOn = max(ends_on)` et `closesOn = soldOn + N mois` (jour du mois ramené au dernier jour du
   mois quand il n'existe pas : 31/08 + 6 mois = 28/02, ou 29/02). Le dernier jour ouvert est la veille
   de `closesOn` ; `closesOn` est le premier jour fermé. Lecture cohérente avec les périodes
   demi-ouvertes de l'ADR 029 : `ends_on` est le premier jour de l'acquéreur, `closesOn` le premier jour
   sans accès.

2. **Rien n'est stocké.** Ni date de coupure figée, ni drapeau, ni tâche planifiée : l'état est recalculé
   à chaque lecture depuis `parcel_ownership` et le paramètre `member.access_after_sale_months`. Un
   rachat sur la même fiche (nouvelle période ouverte) la rouvre de lui-même ; un changement du délai
   s'applique à toutes les fiches, y compris celles déjà fermées.
3. **La règle de session devient asynchrone et reste unique.** `canOpenSessionOn(user, organization,
{impersonated})` rend une promesse : SuperAdmin → oui ; pas de ligne `member` → non ; session ouverte à
   la place d'un compte (s48) → oui ; rôle d'association autre que `member` (`board`, `owner`) → oui
   (règle de s12d : on ne retire jamais le bureau) ; sinon, la façade chargée **par `import()`**
   `hasMemberSpaceAccessService(organizationId, userId)` décide : oui si le compte n'a aucune fiche reliée
   (hors règle) ou si au moins une fiche reliée est `out_of_rule`, `owner` ou `grace`. Une erreur de
   lecture refuse (fermé par défaut) et se journalise. Les quatre appelants passent par elle.
4. **Accès à une fiche, côté membre seulement.** Une fonction distincte,
   `getMyAccessibleProfiles(organizationId, userId)`, rend les fiches reliées hors `closed`, chacune avec
   `soldOn` quand elle est en `grace`. Elle remplace « mes fiches » dans **tous** les lecteurs et
   écrivains de l'espace membre (terrains, coordonnées, adresses, factures, documents, signalements,
   questions, activation d'une adresse en attente) et dans les deux accès par identifiant (PDF d'une
   facture, fichier d'un document). `getMemberProfilesByUserIdDao` et `getMyMemberProfiles` restent
   inchangés pour le bureau.
5. **Visibilité pendant le délai** : pour une fiche en `grace`, une facture est visible si
   `issued_on < soldOn`, un document si `document_date < soldOn` — même impayée, une facture émise à partir
   de la vente est masquée. Une fiche `owner` ou `out_of_rule` n'est pas filtrée.

## Considered options

- **Date de coupure figée à la vente** (colonne sur la fiche ou la période, posée par
  `recordSaleService`) — rejeté : l'arbitrage veut qu'un changement du délai s'applique rétroactivement ;
  une date figée demanderait une migration de données à chaque changement, une seconde source de vérité
  à tenir avec les périodes (rachat sur la même fiche, rattachement d'une parcelle) et une déclaration
  de plus à l'inventaire s12c.
- **Tâche planifiée qui retire la ligne `member` à l'échéance** (`scheduled_job`, ADR 006) — rejeté :
  contraire au critère 3 (contrôle à la lecture, sans tâche) ; une coupure n'arriverait qu'au passage de
  la tâche ; retirer la ligne `member` (`closeMemberAccount`) défait le lien que le rachat doit retrouver
  sans intervention (critère 7) et retirerait le bureau d'un vendeur membre du bureau.
- **Règle par compte** (le délai ne part que quand le compte n'a plus aucune fiche propriétaire) —
  rejeté par l'arbitrage du 26/11 : le proche d'une fiche vendue doit perdre **cette** fiche (critère 5),
  quelles que soient ses autres fiches.
- **Filtrer dans `getMemberProfilesByUserIdDao` / `getMyMemberProfiles`** — rejeté : ces lectures
  servent aussi le bureau (« Ce compte réunit aussi », détection d'une adresse partagée de s53, traces de
  passation) ; les fiches closes disparaîtraient de l'écran du bureau, qui doit tout consulter.
- **Une seconde fonction appelée après `canOpenSessionOn`, laissée synchrone** — rejeté : deux règles à
  ne pas oublier dans quatre appelants ; l'ADR 034 a voulu une règle unique pour qu'aucun mode de
  connexion n'y échappe.
- **Condition calculée dans `customSession`** et portée par l'objet `user` — rejeté pour la raison de
  l'ADR 038 : `customSession` ne reçoit pas l'hôte de façon fiable, donc pas l'association.
- **Délai en jours** (unité `days` existante, seed 183) — rejeté par l'arbitrage : la règle de
  l'association parle en mois.

## Consequences

- Une lecture de plus par requête authentifiée d'un compte de rôle `member` (fiches liées, leurs périodes,
  le paramètre), dédoublonnée dans la requête par le `cache()` de `getAuthUser` ; aucune pour le
  SuperAdmin ni le bureau. Jamais en `'use cache'` : donnée par compte, et l'horloge est lue.
- L'horloge est lue une fois par le service (`calendarDayOf(new Date())`), la règle pure reçoit `today` :
  le critère 3 se prouve en unitaire (J-1 / J / J+1), l'e2e pose des périodes relatives au jour réel.
- La lecture se fait sous `withTenant(organizationId)` : hors scope elle ne rendrait aucune fiche, donc
  « hors règle » — test explicite que le scope est ouvert sur l'association du domaine.
- Un vendeur hors délai qui demande un lien ne reçoit rien (écran B, comme un compte inconnu, ADR 034) ;
  une session ouverte bute sur l'écran D (« accès fermé ») au rechargement suivant (ADR 038).
- Le lancement des invitations (s42b) suit la règle au niveau du compte : un compte refusé n'obtient
  aucun lien et son destinataire passe en échec, rien n'est envoyé. L'invitation individuelle (s42a)
  refuse en plus, côté serveur, une fiche `closed`. Les campagnes (s25, s27) restent au choix de cible du
  bureau.
- Une connexion à la place d'un compte (s48) s'ouvre toujours ; l'espace vu est celui que la règle laisse
  au compte (les fiches `closed` n'y figurent pas) ; le bureau consulte tout depuis la fiche.
- Les relevés (s17, s18) ne sont pas livrés : s18 devra appliquer le même `soldOn` à ses lectures.
- Une date de vente saisie par erreur fixe une échéance fausse, sans correction possible dans
  l'application (ADR 029 §4) ; la date prévue affichée sur la fiche du bureau rend l'erreur visible.
- Le conseil RGPD reste à consulter sur la durée : le délai est un paramètre, aucune purge n'est codée.
