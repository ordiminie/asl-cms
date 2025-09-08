# Pull Request Template

## Description des changements

Décrivez brièvement les changements apportés dans cette PR :

<!-- Expliquez le problème résolu ou la fonctionnalité ajoutée -->

## Type de changement

Cochez les cases appropriées :

- [ ] 🐛 Bug fix (changement qui corrige un problème)
- [ ] ✨ Nouvelle fonctionnalité (changement qui ajoute une fonctionnalité)
- [ ] 💥 Breaking change (changement qui pourrait casser la compatibilité)
- [ ] 🔧 Refactoring (changement qui n'ajoute pas de fonctionnalité ni ne corrige de bug)
- [ ] 📝 Documentation (mise à jour de la documentation)
- [ ] 🎨 Style (changements de formatage, pas de changement de code)
- [ ] ⚡ Performance (changement qui améliore les performances)
- [ ] 🧪 Tests (ajout ou modification de tests)
- [ ] 🔨 Configuration (changements de configuration, scripts, etc.)

## Couches d'architecture affectées

Cochez les couches modifiées (selon l'architecture en couches du projet) :

- [ ] **Presentation** (`src/app/`, `src/components/`)
- [ ] **DAL (Data Access Layer)** (`src/app/dal/`)
- [ ] **Facade** (`src/services/facades/`)
- [ ] **Service** (`src/services/`)
- [ ] **Persistence** (`src/db/`)

## Composants/Domaines touchés

Cochez les domaines concernés :

- [ ] 🔐 **Authentification** (Better Auth, sessions, 2FA)
- [ ] 💳 **Stripe** (paiements, abonnements, webhooks)
- [ ] 🏢 **Organisations** (gestion multi-tenant)
- [ ] 🗄️ **Base de données** (modèles Drizzle, migrations)
- [ ] 🎨 **Interface utilisateur** (composants, styles, responsive)
- [ ] 🌐 **Internationalisation** (messages, locales)
- [ ] 📧 **Emails** (templates, envoi)
- [ ] 🔔 **Notifications** (système de notifications)
- [ ] 📊 **Dashboard/Analytics** (métriques, reporting)
- [ ] 🛡️ **Autorisation** (CASL, permissions)
- [ ] 🔗 **API** (endpoints, validation)
- [ ] ⚙️ **Configuration** (environnement, configuration)

## Tests

- [ ] Les tests unitaires passent (`pnpm test`)
- [ ] Les tests e2e passent (`pnpm e2e`)
- [ ] De nouveaux tests ont été ajoutés si nécessaire
- [ ] La couverture de test est maintenue/améliorée

## Validation technique

- [ ] Le code suit les conventions du projet
- [ ] Le linting passe (`pnpm lint`)
- [ ] Le formatage est correct (`pnpm format`)
- [ ] Le build de production réussit (`pnpm build`)
- [ ] Pas d'erreurs TypeScript
- [ ] Les migrations de base de données sont incluses si nécessaire
- [ ] Les variables d'environnement sont documentées dans `env.example`

## Sécurité

- [ ] Aucun secret ou clé d'API n'est exposé
- [ ] Les données sensibles sont correctement validées
- [ ] Les autorisations sont correctement vérifiées
- [ ] Pas de failles de sécurité introduites

## Performance

- [ ] Les requêtes de base de données sont optimisées
- [ ] Les composants React utilisent la mémorisation si approprié
- [ ] Les images sont optimisées
- [ ] Pas d'impact négatif sur les Core Web Vitals

## Screenshots/Démos

<!-- Si la PR affecte l'interface utilisateur, ajoutez des captures d'écran -->

### Avant
<!-- Capture d'écran ou description de l'état précédent -->

### Après
<!-- Capture d'écran ou description du nouvel état -->

### Version mobile (si applicable)
<!-- Capture d'écran mobile si l'UI est affectée -->

## Notes supplémentaires

<!-- Toute information supplémentaire pour les reviewers -->

## Checklist pour la revue

### Pour l'auteur
- [ ] J'ai testé ces changements localement
- [ ] J'ai vérifié que tous les tests passent
- [ ] J'ai mis à jour la documentation si nécessaire
- [ ] J'ai vérifié l'impact sur les performances
- [ ] Les messages de commit suivent les conventions du projet

### Pour les reviewers
- [ ] Le code est clair et compréhensible
- [ ] Les changements respectent l'architecture en couches
- [ ] La logique métier est correctement implémentée
- [ ] Les erreurs sont gérées appropriément
- [ ] L'impact sur les autres fonctionnalités a été considéré

## Déploiement

- [ ] Ces changements nécessitent des migrations de base de données
- [ ] Ces changements nécessitent une mise à jour des variables d'environnement
- [ ] Ces changements nécessitent une synchronisation avec Stripe
- [ ] Ces changements sont compatibles avec la version de production actuelle

---

<!-- 
Instructions pour remplir ce template :
1. Remplissez toutes les sections applicables
2. Cochez toutes les cases pertinentes
3. Ajoutez des captures d'écran pour les changements UI
4. Mentionnez les reviewers appropriés
5. Liez les issues GitHub correspondantes avec "Fixes #123"
-->