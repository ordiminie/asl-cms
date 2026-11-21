# Research — Story s30-stats-campagnes

## Target story

**En tant que** membre du bureau **je veux** consulter les taux d'ouverture et de clic de mes campagnes
**afin de** savoir si l'information passe. Complexité 2. Dépendances : s25, s26.

Critères d'acceptation :

1. La fiche d'une campagne envoyée affiche le nombre d'envois, d'ouvertures et de clics, avec les taux
   correspondants.
2. Une campagne étalée en plusieurs parts (s26) présente des statistiques consolidées sur l'ensemble de la
   campagne.
3. Des statistiques indisponibles ou pas encore consolidées côté fournisseur s'affichent comme telles, sans
   chiffre inventé ni zéro trompeur.
4. Les statistiques d'une association ne sont jamais visibles d'une autre.

Notes : **restitution, pas mesure** — Brevo mesure déjà ; aucun pixel, aucun compteur maison. Distinguer
« 0 ouverture » de « statistique pas encore disponible ».

## Current state of the code

**Envoi d'une campagne** (s25, s26, ADR 051/052/053) — chaque destinataire reçoit un email **transactionnel
unitaire** ; il n'y a pas de « campagne » côté Brevo :

- `src/services/campaign-service.ts` — `deliverCampaignPartService(job, now)` (gestionnaire
  `campaign.deliver_part`, sans session) livre les lignes `pending` d'une part, une par une, via
  `deliverToRecipient` → `composeRecipientEmail` → `sendEmailService(payload, {scope: 'tenant',
organizationId, nature: 'campaign'}, {recipientType: 'client'})`. `composeRecipientEmail` construit un
  `SendEmailPayload` avec `headers: listUnsubscribeHeaders(...)`.
- `src/services/email-service.ts` — `sendEmailService` → `composeEmail(payload): ComposedEmail` →
  `sendTenantEmail` → `transmitWithinBudget` → `transmitComposedEmail(email)` qui appelle
  `getEmailTransport().send({from, to, subject, text, html?, headers?, replyTo?})`.
- `src/lib/emails/transport/email-transport.ts` — contrat `EmailTransport = {send: (message: EmailMessage)
=> Promise<void>}`. **Aucune opération de statistiques**, aucun champ de tag. Implémentations : `brevo`,
  `resend` (secours, ADR 017), `file`, `memory` ; choix par `EMAIL_TRANSPORT` (`get-email-transport.ts`,
  `resolveEmailTransport(config)` / `getEmailTransport()`).
- `src/lib/emails/transport/brevo-transport.ts` — `POST https://api.brevo.com/v3/smtp/email` par `fetch`,
  sans SDK ; corps `toBrevoBody(message)` ; la réponse (`{messageId}`) est **ignorée**. Erreur :
  `EmailTransportError('brevo', …, {refused})`.

**Lecture d'une campagne** :

- `src/db/models/campaign-model.ts` — `campaign` (RLS forcée ; `sentCount`, `recipientCount`, `status`
  `sending|sent|interrupted`, `sendDate`, `finishedAt`, `createdAt`), `campaign_part` (une par jour, `status`,
  `scheduledFor`, `finishedAt`), `campaign_recipient` (une ligne par **adresse**, `status`
  `pending|sending|sent|failed|to_verify|unsubscribed`, `sentAt`). La doc du modèle dit explicitement :
  `campaign_recipient` est la « source des statistiques de s30 ».
- `getCampaignService({organizationId, campaignId})` — `parseOrThrow(campaignByIdServiceSchema)`,
  `requireCampaignManager(organizationId)`, puis `withTenant` + `getCampaignByIdDao` +
  `withPartsAndCounts` ; renvoie `CampaignReadResult` (`found` | `not_found`).
  `campaign.recipientCounts.received` = lignes `sent`.
- `src/app/dal/campaign-dal.ts` — `getCampaignDal = cache(...)`, **sans cache persistant** (données
  personnelles, ADR 038), streamé derrière `<Suspense>`.
- `src/app/[locale]/(bureau)/bureau/campagnes/[id]/page.tsx` — `CampaignSection` lit en parallèle campagne,
  destinataires, courrier (s28), réglages ; chaque lecture secondaire est `.catch(() => undefined|null)`.
- `src/components/features/campaigns/campaign-detail.tsx` (736 lignes) — `CampaignDetail` empile
  `ProgressCard`, `PartsCard` (si > 1 part), `RecipientsCard`, `CampaignLetterCard`, `Summary`,
  `SentContent`. `ProgressCard` montre le motif **Compteur** du design system (`dl` libellé/valeur `font-mono
tabular-nums`, quatre colonnes ≥ 640 px).

## Anchor points

1. **Marquer chaque email d'une campagne côté fournisseur** pour pouvoir l'agréger : un tag Brevo par
   campagne (identifiant non personnel, p. ex. l'`id` uuid de la campagne). Chemin à étendre :
   `composeRecipientEmail` → `SendEmailPayload` → `ComposedEmail` → `EmailMessage` → `toBrevoBody`
   (`tags: [...]`). Les autres transports l'ignorent (Resend a aussi des tags, mais le secours n'a pas de
   lecture de stats dans cette story).
2. **Lire les statistiques** : nouvelle capacité du contrat `EmailTransport` (ADR 005 l'annonçait :
   « envoi unitaire, envoi de campagne, et lecture des statistiques d'ouverture et de clic (s30) » ; ADR 017
   et le code s'en tiennent à `send`). Brevo l'implémente ; `file`/`memory`/`resend` répondent
   « indisponible » (ou `memory` sert de bouchon de test).
3. **Service** : une lecture `getCampaignStatisticsService({organizationId, campaignId})` dans
   `campaign-service.ts`, même garde que `getCampaignService` (`requireCampaignManager` + campagne lue dans
   `withTenant` **avant** tout appel au fournisseur : une campagne d'une autre association est `not_found`
   sans requête Brevo) + façade `campaign-service-facade.ts`.
4. **DAL** : `getCampaignStatisticsDal` dans `campaign-dal.ts`.
5. **UI** : une carte « Statistiques » dans `CampaignDetail` (motif Compteur), dans **son propre
   `<Suspense>`** pour que la lenteur ou l'échec de Brevo ne retarde ni ne casse la fiche. Libellés dans
   `messages/fr.json` (`CampaignsBureau.detail.*`).

## Verified APIs / functions

Brevo (vérifié sur developers.brevo.com le 21/11/2026) :

- `POST /v3/smtp/email` accepte `tags: string[]` (« Array of tags for categorizing and filtering emails »,
  sans contrainte documentée) ; réponse 201 `{"messageId": "<…>"}`.
- `GET /v3/smtp/statistics/aggregatedReport?tag=<tag>&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` (ou
  `days`, max 90, incompatible avec les dates). **La plage ne peut pas dépasser 90 jours** ; sans paramètre,
  les 90 derniers jours. Réponse, tous champs **optionnels** (entiers) : `range`, `requests`, `delivered`,
  `hardBounces`, `softBounces`, `clicks`, `uniqueClicks`, `opens`, `uniqueOpens`, `spamReports`, `blocked`,
  `invalid`, `unsubscribed`.
- Les stats de l'agrégat couvrent **toutes les parts** d'un même tag : la consolidation du critère 2 est
  native si toutes les parts portent le même tag.

Code (ouvert) : `createBrevoTransport({apiKey})`, `BREVO_SEND_URL`, `EmailTransportError(transport,
message, {cause, refused})`, `resolveEmailTransport(config: EmailTransportConfig)`, `getEmailTransport()`,
`sendEmailService(payload, context, options)`, `transmitComposedEmail(email)`, `SendEmailPayload`,
`ComposedEmail`, `getCampaignService`, `getCampaignDal`, `CampaignDetail`, `ProgressCard`.

## Traps & constraints

1. **Fenêtre de 90 jours de Brevo.** Au-delà, l'agrégat ne remonte plus rien : une campagne de plus de
   90 jours afficherait « indisponible » si l'on lit en direct. Garder un **instantané** des chiffres reste de la
   restitution (pas de mesure) mais ajoute une colonne ou une table. À trancher au plan.
2. **« Pas encore consolidé » n'est pas signalé par Brevo.** L'API ne dit pas si un agrégat est définitif.
   Signaux disponibles : campagne encore `sending` (parts à venir) ; `requests` (ou `delivered`) Brevo
   inférieur à notre `sentCount` (Brevo n'a pas encore compté tous les envois) ; champ absent de la réponse.
   Un agrégat vide (tout à 0/absent) juste après l'envoi n'est **pas** « 0 ouverture » — c'est le cœur du
   critère 3.
3. **Campagnes antérieures à s30** : envoyées sans tag, elles ne peuvent pas être agrégées → « indisponible »
   (jamais 0). Aucune campagne réelle en production à ce jour (premier déploiement non fait), seulement la
   recette.
4. **Transports sans statistiques** (`resend` de secours, `file`, `memory`) : « indisponible », jamais 0.
   Une campagne partiellement envoyée par Resend aurait des stats Brevo partielles : hors périmètre, à
   mentionner seulement.
5. **Clé Brevo restreinte à l'IP du VPS de recette** (mémoire projet) : aucun appel réel possible depuis le
   poste ; tests unitaires par `fetch` bouchonné (motif de `brevo-transport.test.ts` :
   `vi.stubGlobal('fetch', fetchMock)`), vérification réelle en recette.
6. **Isolation (critère 4)** : le tag est un uuid global, mais la garantie vient de l'ordre service —
   lire la campagne sous `withTenant` d'abord ; une campagne d'une autre association n'atteint jamais le
   fournisseur. La RLS n'est pas testable en unitaire : test d'accès croisé en e2e Playwright (convention
   ADR 002). Un seul compte Brevo pour l'instant (mémoire : une clé par asso au 2e client) — si deux
   associations partageaient un compte, l'uuid reste non devinable et le contrôle se fait avant l'appel.
7. **Taux** : `opens`/`clicks` comptent chaque ouverture ; `uniqueOpens`/`uniqueClicks` comptent les
   destinataires. Dénominateur possible : notre `sentCount` (lignes `sent`) ou `delivered` Brevo. Les
   ouvertures sont **surestimées** par la protection de la vie privée d'Apple Mail (pré-chargement) et
   **sous-estimées** par les clients qui bloquent les images ; une mention d'interprétation peut éviter une
   lecture trop littérale. À trancher au plan.
8. **Cache** : l'agrégat n'est pas une donnée personnelle (des compteurs), mais il change pendant des jours.
   La DAL campagne n'a **aucun cache persistant** ; appeler Brevo à chaque affichage de la fiche est
   acceptable au volume (quelques consultations par campagne). Délai réseau : un `AbortSignal.timeout` pour
   ne pas suspendre la carte indéfiniment.
9. **Suivi des clics côté Brevo** : Brevo réécrit les liens pour compter les clics, y compris le lien de
   désinscription du pied de page — un clic de désinscription compte comme clic. Le suivi d'ouverture/clic
   doit être actif dans le compte Brevo (paramètre du compte, pas du code) : à vérifier en recette.
10. **Logger** : ne pas journaliser la clé ; pas de `logger` dans une fonction `'use cache'` (aucune ici).
11. **Design system** : « Pas de composant statistique » ; motif **Compteur** (`dl` 15/17 px, une paire par
    ligne sous 640 px) ; **pas de pourcentage inventé** (§2.1) — ici la source compte vraiment, le taux est
    légitime. L'état « indisponible / pas encore consolidé » se compose avec l'`alert` neutre sans icône
    (« annoncer l'avenir ») ou un texte `muted-foreground`. Story UI → `/ks-design` requis.
12. **Commit** : stager chemin par chemin (arbre partagé) ; `pnpm test --run` ; montage 9p lent (valider sur
    copie en disque local si timeouts).

## Open questions

1. **Lecture en direct ou instantané persisté ?** Direct : zéro table, mais « indisponible » après 90 jours.
   Instantané : chiffres conservés (colonnes sur `campaign` ou table dédiée) rafraîchis à la consultation
   tant que la fenêtre Brevo couvre la campagne. Recommandation : instantané minimal sur `campaign`, mis à
   jour à la lecture — sinon le bureau perd les chiffres de la campagne de convocation d'AG l'année suivante.
2. **Quels chiffres et quel taux ?** Recommandation : envois = `sentCount` ; ouvertures et clics = uniques
   (`uniqueOpens`, `uniqueClicks`) ; taux = unique / envois. Ouvertures totales non affichées.
3. **Règle « pas encore consolidé »** : campagne `sending`, ou `requests` Brevo < `sentCount`, ou réponse
   sans champ → « pas encore disponible » ; sinon chiffres, même à 0. Faut-il en plus un délai minimal après
   la dernière part (p. ex. quelques heures) ? Recommandation : non, s'en tenir aux signaux mesurés.
4. **Fenêtre de dates de la requête** : du jour de création de la campagne (`createdAt`, Paris) à
   min(aujourd'hui, création + 89 jours).
5. **Extension du contrat `EmailTransport`** : opération optionnelle (`readTagStatistics?`) ou obligatoire
   renvoyant `unavailable` ? → ADR (amende ADR 005/017).
6. **Mention d'interprétation** (Apple Mail, images bloquées) sous les chiffres : oui/non — à proposer au
   design, pas à ajouter sans le design system.
