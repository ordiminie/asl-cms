# ADR 036 — Déploiement : service systemd, build sur le serveur, nginx + certbot

- Status: accepted
- Date: 2026-10-19
- Scope: story s12b-mise-en-ligne

## Context

s12b met l'application en ligne sur un VPS. Elle doit servir chaque association en HTTPS sur son
propre domaine, appliquer les migrations avant la bascule et laisser la version précédente en
service si l'une d'elles échoue, conserver les fichiers téléversés et purger chaque jour les
empreintes des formulaires publics. L'ADR 001 fixe l'hébergement (un VPS unique, infogéré par le
prestataire) mais ne dit pas **comment** l'application y tourne ni ce qui la place derrière HTTPS.

Les contraintes relevées dans le code (`docs/research/s12b-mise-en-ligne.md`) :

- les scripts d'exploitation (`db:migrate`, `db:check`, la purge de s08b) passent par `tsx` et lisent
  `src/` et `drizzle/` ; un déploiement qui n'emporte que la sortie du build les rend inexécutables ;
- les `NEXT_PUBLIC_*` sont figées au build, et le build lit l'environnement complet ;
- `next build` réécrit `.next/` : construire dans le répertoire servi empêche la version précédente
  de « rester en service » ;
- le tenant est résolu d'après `x-forwarded-host`, puis `host`, et Next ne remplace pas un
  `x-forwarded-*` déjà présent. Le proxy doit donc **écraser** ces en-têtes, et l'application ne
  doit pas être joignable sans passer par lui ;
- un certificat **par domaine**, obtenu et renouvelé sans intervention, parce qu'un certificat
  commun casse tous les sites dès qu'un seul domaine échoue à la validation.

Le premier serveur (recette) est un VPS Debian 13 **partagé** : nginx y tient déjà les ports 80 et
443 et sert un autre site, dont certbot gère le certificat. Un agent automatisé y tourne sous son
propre utilisateur. La production cible est le VPS LWS du contrat.

## Decision

1. **Un service systemd, sans conteneur.** L'application tourne sous l'utilisateur système dédié
   `asl-cms`, avec `next start -H 127.0.0.1 -p 3100` : elle n'écoute que sur la machine elle-même.
2. **Le build se fait sur le serveur, dans un répertoire par version** :
   `/srv/asl-cms/releases/<commit>`. `/srv/asl-cms/current` est un lien symbolique vers la version
   en service. `/srv/asl-cms/shared/` contient ce qui survit aux versions : le fichier d'environnement
   `.env.production`, lisible par `asl-cms` seul et lié dans chaque version, ainsi que
   `LOCAL_STORAGE_ROOT`.
3. **Ordre du déploiement** : installation, build, migrations, contrôle du rôle applicatif,
   bascule du lien, redémarrage, vérification. Toute étape en échec avant la bascule arrête le
   déploiement : la version précédente reste en service. Un retour arrière consiste à faire
   repointer le lien vers la version précédente, conservée sur le disque.
4. **nginx + certbot devant l'application.** Un fichier de configuration par domaine d'association,
   un certificat par domaine (`certbot certonly --webroot --cert-name <domaine>`), renouvelés par
   la minuterie de certbot avec rechargement de nginx. HTTP redirige vers HTTPS. nginx écrase
   `Host`, `X-Forwarded-Host`, `X-Forwarded-Proto` et `X-Forwarded-For` (adresse du client seule),
   ne met pas les réponses en tampon et accepte des corps de 17 Mo (enveloppe applicative de
   16 Mo, ADR 026).
5. **Les planifications du serveur sont des minuteries systemd** (`asl-cms-*.timer`). La purge
   quotidienne de s08b est la première ; s12c (sauvegardes) et s26 (déclencheur de l'ADR 006) y
   ajouteront les leurs. Une minuterie peut lancer un script comme une requête HTTP, et
   `journalctl` garde la trace de chaque passage.
6. **Le déploiement est lancé à la main** sur le serveur par le prestataire, selon la procédure de
   `docs/exploitation/`. Aucun workflow GitHub ne détient d'accès au serveur.

## Considered options

- **Image Docker de production** — rejetée : une couche de plus à construire, comprendre et
  dépanner. Elle doit de toute façon embarquer `tsx`, `src/` et `drizzle/` pour les scripts, ce qui
  supprime l'avantage d'une image minimale. Le prestataire exploite seul.
- **Build en CI, copie du résultat sur le serveur** — rejeté : la CI devrait détenir un accès au
  serveur (un secret de dépôt, sur un dépôt public) et une base migrée avec les valeurs publiques de
  production. Le serveur de recette (4 cœurs, 7,8 Go) absorbe le build.
- **Build en place dans le répertoire servi** — rejeté : `next build` réécrit `.next/` sous la
  version qui tourne, ce qui contredit le critère « la version précédente reste en service ».
- **Caddy** — rejeté pour la recette comme pour la production : sur le serveur de recette, il
  faudrait migrer le site déjà servi par nginx et risquer de le couper. Garder deux outils selon le
  serveur doublerait la procédure. Caddy gère les certificats sans commande par domaine, mais une
  commande certbot par association, écrite dans la procédure d'ajout d'un domaine, est un coût
  acceptable pour six associations.
- **Un certificat unique listant tous les domaines** — rejeté : il faut le réémettre à chaque
  nouvelle association, et un domaine en échec bloque tous les autres (piège n° 3 de la story).
- **Crontab de l'utilisateur pour les planifications** — rejetée : un cron qui échoue ne laisse
  aucune trace consultable par défaut, alors qu'une minuterie systemd en laisse dans le journal.
  Une minuterie hérite aussi de l'environnement, de l'utilisateur et du durcissement déclarés dans
  l'unité.

## Consequences

- Ajouter une association, c'est la provisionner dans `/admin`, créer son enregistrement DNS et
  lancer `ops/add-domain.sh <domaine>`. Aucune modification du code.
- Un redéploiement ne touche ni `shared/` ni la base hors migrations. Les fichiers téléversés
  survivent, à condition que `LOCAL_STORAGE_ROOT` reste absolu et pointe dans `shared/`.
- Une migration **réussie** suivie d'un démarrage en échec laisse, après le retour arrière,
  l'ancienne version sur le schéma migré. Drizzle n'écrit pas de migration descendante : la
  sauvegarde de s12c couvre ce cas, rien de plus n'est promis.
- Chaque build change la clé de chiffrement des Server Actions. Une page ouverte avant la bascule
  peut échouer sur sa première action après : on le tolère.
- Le build dépend du réseau, pour télécharger les polices Google (`next/font/google`).
- Sur un serveur partagé, l'isolation tient à l'utilisateur `asl-cms` (répertoires en `750`,
  environnement en `600`), au PostgreSQL qui n'écoute que sur la machine, et à l'application liée
  à `127.0.0.1`.
