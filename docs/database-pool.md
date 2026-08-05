# Pool de connexions Postgres — le réglage à ne pas « optimiser » à l'envers

Deux réglages gouvernent la tenue en charge : la taille du pool applicatif
(`DATABASE_POOL_MAX`) et le mode du pooler (le port dans `DATABASE_URL`). Ils
sont contre-intuitifs tous les deux, et se sont payés en incident de production.

**La règle par défaut, pour un déploiement serverless (Vercel, Netlify,
Cloudflare) : `DATABASE_POOL_MAX=1` et `DATABASE_URL` sur le port 6543 (mode
transaction).**

Si vous déployez sur un serveur long-running, la première moitié de cette règle
s'inverse — voir la dernière section.

---

## 1. Pourquoi 1, et pas 3 ou 10

### La formule

```
connexions retenues = DATABASE_POOL_MAX × instances actives
```

En serverless, **chaque instance ouvre son propre pool**. Il n'est pas mutualisé.
Le nombre d'instances grimpe avec le trafic, et c'est ce produit qui doit rester
sous la limite du pooler.

Avec un pool Supavisor de 15 :

| `DATABASE_POOL_MAX` | Instances avant saturation |
| ------------------- | -------------------------- |
| 3                   | **5**                      |
| 1                   | **15**                     |

Augmenter le pool applicatif **réduit** le nombre d'instances que
l'infrastructure peut porter.

### Pourquoi les connexions en trop ne servent à rien

Un pool évite de repayer l'ouverture d'une connexion — TCP, TLS,
authentification, soit 50 à 100 ms. C'est un gain réel dans un serveur Node
classique, où le pool est partagé entre toutes les requêtes concurrentes du
process.

Une instance serverless traite très peu de requêtes à la fois. Un pool de 3 y
signifie : la première requête ouvre une connexion, et les deux autres places
restent réservées pour une concurrence qui n'arrivera pas.

Elles ne sont pas gratuites. `idleTimeoutMillis` vaut 30 s : une connexion reste
**comptée 30 secondes après sa dernière utilisation**, instance au repos
comprise.

Et avec un pooler en mode transaction devant, le pooling est déjà fait en amont :
le pool applicatif ne fait plus que du pooling par-dessus du pooling.

### Ce qu'on perd

Si une instance reçoit deux requêtes vraiment simultanées, la seconde attend la
connexion. En mode transaction, cette attente se compte en **millisecondes** — la
connexion est rendue à la fin de la transaction, pas de la session.

L'arbitrage : attendre quelques millisecondes, ou renvoyer une erreur à un
visiteur.

---

## 2. Pourquoi le port 6543

| Port | Mode | Comportement |
| ---- | ---- | ------------ |
| 5432 | **session** | Un client monopolise sa connexion toute la session. 15 connexions = **15 clients simultanés, point final.** |
| 6543 | **transaction** | La connexion est prise puis rendue par transaction. 15 connexions servent **des centaines de clients**. |

À ~20 ms par requête, 15 connexions en mode transaction absorbent
théoriquement autour de **750 requêtes/seconde**. Les mêmes 15 en mode session
plafonnent à 15 clients.

La documentation Supabase recommande explicitement le mode transaction pour le
serverless : *« ideal for serverless or edge functions, which require many
transient connections »*.

### Shared pooler, pas dedicated

Deux hôtes, et c'est le piège classique :

- `db.<ref>.supabase.co:6543` → **dedicated pooler**, IPv6 par défaut. Depuis un
  réseau IPv4-only (Vercel), il faut l'add-on payant.
- `<region>.pooler.supabase.com:6543` → **shared pooler**, IPv4 sur tous les
  forfaits. **C'est celui-ci.**

Le nom d'utilisateur diffère : `postgres.<project-ref>` pour le shared pooler,
`postgres` pour la connexion directe. Pour passer de session à transaction, il
suffit donc de remplacer `5432` par `6543` dans l'URL du shared pooler.

### Aucune adaptation de code

Le mode transaction ne supporte pas les prepared statements. Sans effet ici :
le boilerplate utilise `drizzle-orm/node-postgres`, et node-postgres n'en crée
pas par défaut. Pas de `?pgbouncer=true`, pas de `prepare: false` — cette option
concerne `postgres.js`.

### Les migrations restent en connexion directe

`drizzle.config.ts` et les scripts (`migrate`, `seed`, `clear`) lisent
`DATABASE_URL`. **Ne basculer que la production sur 6543** ; garder le port
direct en `.env.local` pour que les migrations passent. Si elles tournent un
jour en CI, prévoir une variable `DIRECT_URL` distincte.

---

## 3. Ce que ça a coûté de l'apprendre

Mesuré en production, 20 utilisateurs simultanés, même application avant et
après :

| Configuration            | Erreurs base de données | p(95)    |
| ------------------------ | ----------------------- | -------- |
| session 5432, pool 3     | **29**                  | 1 269 ms |
| transaction 6543, pool 1 | **0**                   | 1 502 ms |

Puis, après correctif : **32 110 requêtes à 200 utilisateurs simultanés, zéro
erreur.**

L'erreur était `EMAXCONNSESSION — max clients reached in session mode, max
clients are limited to pool_size: 15`.

**Le détail qui doit alerter :** l'outil de test de charge annonçait **0 %
d'échec** pendant que ces 29 erreurs se produisaient. En rendu streaming (App
Router), les en-têtes HTTP partent avant que le composant serveur échoue :
l'erreur est servie dans une réponse `200`, avec du HTML. Seul le traceur
d'erreurs les a vues.

**Ne jamais conclure que la base tient sur la foi d'un taux d'échec HTTP.**

---

## 4. Ce qui ne marche pas pour diagnostiquer

Une sonde exposant les compteurs du pool (`waiting`, `active`, `idle`, `max`)
paraît être le bon instrument. Elle ne l'est pas :

- elle lit le pool **local à l'instance qui répond**, alors qu'il y en a N ;
- elle ignore la limite du **pooler en amont** — une saturation
  `EMAXCONNSESSION` laisse son `waiting` à zéro ;
- elle échantillonne à 1 Hz une attente qui dure quelques millisecondes.

Dans le cas mesuré, `waiting` est resté à **0** pendant les 29 erreurs, puis à
**0** après correctif. Il n'a jamais rien indiqué.

**Un pool à 0 en attente ne disculpe pas la base.** Le seul instrument fiable est
le traceur d'erreurs (Sentry).

---

## 5. Si un jour ça sature

Dans cet ordre, et pas un autre :

1. Vérifier que `DATABASE_URL` est bien sur **6543**. Le mode session est le
   coupable par défaut.
2. Vérifier que `DATABASE_POOL_MAX` vaut bien **1**.
3. Augmenter le **pool_size de Supavisor** (Dashboard → Database Settings →
   Connection pooling). Sa valeur par défaut est 15, ce n'est pas un plafond
   contractuel : la vraie limite est `max_connections` de l'instance — 60 sur
   Nano/Micro. Supabase recommande d'allouer jusqu'à 40 % si PostgREST est très
   sollicité, 80 % sinon.
4. **En dernier recours**, monter `DATABASE_POOL_MAX` à 2 — et seulement si les
   requêtes sont longues (agrégations, rapports), auquel cas la file locale
   devient réellement visible. Recalculer `max × instances` avant.

Augmenter `DATABASE_POOL_MAX` en premier ne supprime jamais une saturation : ça
la déplace vers le serveur Postgres.

---

## 6. Si vous ne déployez pas en serverless

Tout ce qui précède suppose un hébergement où **chaque instance est isolée et
traite peu de requêtes à la fois**. Sur un serveur long-running — VM, conteneur,
Docker, Fly.io en process persistant — la logique s'inverse :

- le pool est **mutualisé** entre toutes les requêtes concurrentes du process ;
- le nombre de process est **stable et connu**, il ne suit pas le trafic ;
- un pool de 1 devient alors un vrai goulot : toutes les requêtes se
  sérialisent sur une connexion unique.

Dans ce cas, régler `DATABASE_POOL_MAX` entre **10 et 20**, et vérifier que
`max × nombre de process` reste sous `max_connections`. Le mode transaction
reste utile mais n'est plus indispensable : une connexion longue durée n'est plus
un problème quand elle est partagée.

**C'est pour cette raison que la valeur est une variable d'environnement et non
une constante :** le bon réglage dépend de la cible de déploiement, pas du code.
