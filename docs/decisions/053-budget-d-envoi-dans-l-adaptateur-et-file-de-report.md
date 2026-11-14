# ADR 053 — Le budget d'envoi se tient dans l'adaptateur, sur un compteur conditionnel ; un email reporté est conservé dans sa propre table

- Status: accepted
- Date: 2026-11-14
- Scope: story s52-budget-envoi-adaptateur

## Context

L'ADR 005 pose que « le quota est une propriété du transport » : tout email sortant décompte le budget
quotidien de son association. s52 le réalise. La recherche (`docs/research/s52-budget-envoi-adaptateur.md`)
a laissé ouverts : la façon dont l'adaptateur connaît l'association (piège n° 1 de la story), la forme du
compteur, l'endroit où vit un message reporté (piège n° 2), la classe des emails jamais reportés, la
frontière de jour et la façon dont un report remonte aux campagnes.

Arbitrages de Marie-Ève (2026-11-14) : jour de Paris (critère 10) **avec une marge** contre une remise à
zéro de Brevo à minuit UTC (non confirmée) ; limite et réserve **modifiables par le SuperAdmin seul** ;
une seule story.

## Decision

1. **Portée explicite, obligatoire.** `sendEmailService(payload, context)` reçoit un second argument
   **obligatoire** : `{scope: 'tenant', organizationId, nature}` ou `{scope: 'platform', nature}`. Aucun
   défaut. `nature` est une liste fermée (`login`, `campaign`, `board_notification`, plus les natures de
   plateforme du boilerplate). La classe « jamais reportée » est **`login`** seule (lien de connexion ;
   les emails de vérification, OTP et mot de passe sont de plateforme) ; une notification au bureau
   (message de contact, signalement) est **reportable**, comme le veut le critère 4.
2. **Résultat typé.** L'adaptateur rend `{status: 'sent'} | {status: 'deferred', until: string} |
{status: 'skipped'}` (`skipped` = interrupteurs d'application). Les appelants qui ignorent le résultat
   restent corrects ; les campagnes le lisent.
3. **Compteur conditionnel, une table dédiée `email_send_budget`** : une ligne par `(organization_id,
day)` (jour de Paris), colonnes `reportable_count` et `login_count`. Un envoi reportable s'accorde par
   `INSERT … ON CONFLICT DO UPDATE SET reportable_count = reportable_count + 1 WHERE reportable_count + 1
<= limite − réserve RETURNING` : aucune ligne rendue = budget épuisé, dans **la même instruction**. Un
   email `login` s'incrémente toujours (`login_count`), jamais refusé. Décompte **avant** l'envoi ; un
   refus certain du fournisseur (`EmailTransportError.refused`) rend l'unité, une issue inconnue la garde.
4. **Message reporté : table dédiée `deferred_email`**, sous RLS forcée : `organization_id`, `nature`,
   destinataire, objet, texte, HTML **déjà rendu**, en-têtes, réponse, nom d'expéditeur, `send_on` (jour
   de Paris), statut `pending | sending | to_verify`, `attempts`, référence d'affichage (type + id de
   l'objet, jamais le contenu). Une tâche `email.deliver_deferred` par message (clé = id du message) la
   rejoue. **La ligne est supprimée** une fois partie (purge, critère 7) ; `to_verify` (arrêt entre envoi
   et enregistrement) n'est jamais renvoyée, comme les campagnes (ADR 052).
5. **Campagnes : pas de copie du contenu.** Un destinataire refusé par le budget est rendu `pending`
   (`releaseRecipientClaimTxnDao`) et la tâche de la part est reprogrammée au jour suivant **sans compter
   de tentative**. La ligne `campaign_recipient` est sa propre file de report.
6. **Jour de Paris, marge de deux heures.** Le compteur suit `calendarDayOf` (Paris). Toute échéance de
   rejeu ou de part d'un jour suivant est posée à **02:00 heure de Paris** au plus tôt (au lieu de
   minuit) : si Brevo remet à zéro à minuit UTC, rien de reportable ne part avant que son compteur ait
   repassé zéro, en hiver comme en été. Un email `login` part à toute heure.
7. **Limite et réserve réservées au SuperAdmin.** Les deux réglages portent un drapeau du registre
   `editableBy: 'super_admin'`. La validation refuse leur modification si `getActingContext()` ne montre
   ni un utilisateur `super_admin`, ni une session ouverte à la place d'un compte par un SuperAdmin.
   La page Réglages les affiche en lecture seule au bureau. Contrôle croisé dans la validation du
   registre : réserve < limite.

## Considered options

- **`organizationId` optionnel sur l'adaptateur** — rejeté : un oubli passe en silence et n'est pas
  décompté, le mode d'échec que la story veut empêcher.
- **Lire le tenant depuis le scope `withTenant` courant** — rejeté : le store ne l'expose pas, et un envoi
  hors scope (worker, `after()`) deviendrait « plateforme » sans le dire.
- **Généraliser `rate_limit_event`** — rejeté : compteur de limiteur sans plafond conditionnel ni réserve,
  clé par empreinte ; mélanger les deux natures rendrait la purge et la lecture ambiguës.
- **Lire-puis-incrémenter, ou compter après l'envoi** — rejeté : deux envois simultanés dépassent ensemble
  (critère 2).
- **Message reporté dans `scheduled_job.payload`** — rejeté : le contrat écrit de cette colonne (modèle,
  types, ADR 052) interdit toute donnée personnelle ; elle n'a ni purge ni statut d'envoi.
- **Exception typée plutôt qu'un résultat** — rejetée : un report n'est pas une erreur, et les ~25
  appelants actuels auraient à l'attraper ou à la laisser remonter à tort.
- **Classer toutes les `recipientType: 'system'` comme jamais reportées** — rejeté : `system` a été conçu
  pour échapper aux interrupteurs, pas au budget ; il embarque les notifications au bureau, que le
  critère 4 veut reportables.
- **Jour UTC** — rejeté par Marie-Ève : contredit le critère 10, et le budget ne suivrait plus le jour
  du plafond des campagnes (s26). **Minuit Paris sans marge** — rejeté : laisse Brevo refuser les envois
  entre 00:00 et 01:00/02:00 si sa remise à zéro est en UTC.
- **Limite et réserve modifiables par le bureau** — rejeté par Marie-Ève : elles décrivent le compte de
  messagerie du prestataire, que le bureau ne connaît pas.

## Consequences

- Deux tables métier de plus (`email_send_budget`, `deferred_email`) : 26 tables sous RLS forcée,
  classement de `docs/architecture.md` et `rls-inventory` à jour ; `daily_send_budget`, cité comme table
  prévue par `docs/architecture.md`, est remplacé par `email_send_budget`.
- Chaque appelant de l'adaptateur déclare sa portée et sa nature : le typage refuse un oubli. s29
  (relances) et s42 (invitations) ajoutent leur nature à la liste.
- Le budget peut être dépassé par les emails `login` seuls (jamais refusés) ; l'écran le dit (réserve
  épuisée).
- Les parts de campagne d'un jour suivant partent à 02:00 Paris, plus à 00:00 (changement de s26).
- Le registre des réglages gagne un drapeau de droits ; il ne sert qu'à ces deux clés.
- Si un second client partage le compte Brevo, le budget par association ne suffit plus (hors périmètre,
  noté dans la story).
