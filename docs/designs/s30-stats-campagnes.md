# Design — Story s30-stats-campagnes

Voie : **AGENT** (lancée par `/ks-orchestrator`). Ancré sur `docs/design-system.md` uniquement.

Contrôle visuel : non fait — le Chromium de Playwright ne démarre pas dans le conteneur
(`libnspr4.so: cannot open shared object file`) ; repli en lecture du HTML le 21/11/2026 (aucune
couleur hors des tokens de `:root`, mesures sur l’échelle du design system, deux versions — règles
1023 et 639 px — et les sept états présents).

## Screen(s)

Une seule surface : une **nouvelle carte « Ouvertures et clics »** dans la fiche d'une campagne
(`/bureau/campagnes/[id]`, `CampaignDetail`). Aucun autre écran ; la liste des campagnes n'affiche
pas de statistiques (la story parle de « la fiche d'une campagne »).

**Place** : juste après la carte « Avancement » (`ProgressCard`), avant « Envois par jour » et
« Destinataires » : l'avancement dit ce qui est parti, la carte suivante dit si c'est lu.

**Chargement indépendant** : la carte est rendue dans son propre `<Suspense>` ; la lecture auprès du
fournisseur ne retarde jamais le reste de la fiche, et son échec n'affecte qu'elle.

Contenu, dans l'ordre (état « disponibles ») :

1. **Titre** `h2` Source Serif « Ouvertures et clics » (gabarit `CardHeading` existant).
2. **Compteur** (`dl`, motif « Compteur » du design system, §3.13) — trois paires :
   - « Emails envoyés » → `302` (`data`)
   - « Ouvertures » → `154` puis, dans la même valeur, `· 51 %` (`data`)
   - « Clics » → `42 · 14 %` (`data`)
     Trois colonnes en bureau, **une paire par ligne** sous 640 px. Les taux sont **arrondis à
     l'entier** et calculés sur les emails envoyés (règle exacte arrêtée au plan) ; jamais de décimale.
3. **Portée** (`meta`) — « Sur l'ensemble de la campagne : 3 envois, du 12/11/2026 au 14/11/2026. »
   Affichée seulement si la campagne compte plus d'une part (critère 2). Une seule part : phrase
   omise.
4. **Lecture des chiffres** (`meta`) — « Une ouverture ou un clic compte une personne, même si elle
   ouvre l'email plusieurs fois. Certaines messageries ouvrent les emails d'elles-mêmes, d'autres
   bloquent le comptage : lisez ces chiffres comme une tendance. »
5. **Source** (`meta`) — « Chiffres fournis par Brevo, le service qui envoie vos emails, relevés le
   21/11/2026 à 10:32. » — l'horodatage n'apparaît que si le plan retient un relevé conservé ; en
   lecture directe, la phrase s'arrête à « … vos emails. ».

Aucune action dans la carte : elle se lit, elle ne se commande pas (pas de bouton « Actualiser » —
recharger la page suffit, comme pour l'avancement).

**Mobile (390 px)** — barre latérale en tiroir (`sheet`), marges 16 px, compteur une paire par
ligne (libellé à gauche, valeur à droite, comme `ProgressCard`), phrases `meta` pleine largeur. Même
contenu, mêmes états.

## Mockup

docs/designs/s30-stats-campagnes.html — visual reference. DO NOT copy into production: Execute builds
with the real components.

## Reused components (from the design system)

- `card` + `CardHeading` — la carte, comme les cartes voisines de `CampaignDetail`.
- **Compteur** (`dl` libellé `meta` 15 px / valeur `data` 17 px `font-mono tabular-nums`, §3.13) — les
  trois chiffres.
- **`alert` neutre sans icône** (fond `muted`, §3.13) — « pas encore disponibles » : il annonce l'avenir.
- Texte `meta` (`muted-foreground`, 15 px) — portée, lecture, source, raisons d'indisponibilité.

## States

Le critère 3 impose de **ne jamais afficher un zéro qui n'est pas mesuré** : un chiffre n'apparaît
que dans l'état « disponibles ». Dans tous les autres états, le compteur n'est pas rendu du tout.

1. **Disponibles** — compteur + phrases ci-dessus.
2. **Disponibles, à zéro** — même rendu que (1), avec `0 · 0 %`. C'est un vrai zéro, mesuré par le
   fournisseur sur une campagne consolidée ; il s'affiche sans habillage particulier.
3. **Pas encore disponibles** — `alert` neutre sans icône :
   - campagne encore en cours d'envoi : titre « Statistiques disponibles après le dernier envoi »,
     texte « Les chiffres porteront sur l'ensemble de la campagne. Dernier envoi prévu le
     14/11/2026. » ;
   - envois terminés mais fournisseur pas encore à jour : titre « Statistiques pas encore
     disponibles », texte « Brevo compte encore les emails de cette campagne. Les chiffres
     apparaissent en général dans les heures qui suivent l'envoi. »
4. **Indisponibles** — pas d'`alert` (ce n'est ni un refus ni une attente) : une phrase `body`
   « Les statistiques de cette campagne ne sont pas disponibles. » suivie d'une raison en `meta` :
   - fournisseur injoignable : « Brevo n'a pas répondu. Rechargez la page dans quelques minutes. » ;
   - campagne envoyée sans suivi (avant cette fonctionnalité) :
     « Cette campagne a été envoyée sans suivi des ouvertures. » ;
   - service d'envoi du moment sans statistiques (secours, ou transport de test), sans relevé
     conservé : « Le service d'envoi utilisé en ce moment ne fournit pas ces statistiques. » ;
   - fenêtre du fournisseur dépassée sans relevé conservé (si le plan retient la lecture directe) :
     « Brevo ne conserve ces chiffres que 90 jours. »
5. **Aucun email parti** (campagne interrompue avant tout envoi) — phrase `meta` seule : « Aucun email
   n'est parti : il n'y a rien à mesurer. »
6. **Chargement** — la carte avec son titre et une phrase `meta` « Lecture des statistiques… » ; pas de
   `skeleton` (réservé aux listes et tableaux).

Erreur : couverte par (4) — la carte ne lève jamais d'erreur visible au-delà d'elle-même.

## Design system gaps

1. **Valeur composée dans un compteur** (nombre + taux, `154 · 51 %`) : le motif « Compteur » ne
   prévoit qu'une valeur par paire. Composition proposée : les deux en `data` dans le même `dd`,
   séparés par un point médian. À verser au design system si retenue.
2. **Fallback de chargement d'une carte isolée** : le design system réserve `skeleton` aux listes et
   tableaux et ne dit rien d'une carte chargée seule. Proposé : titre + phrase `meta`. À trancher.
3. **État « indisponible » non bloquant** : ni `alert` (pas d'attente, pas de refus), ni vide (§3.2,
   qui appelle une action). Proposé : phrase `body` + raison `meta`. À verser si retenu.
