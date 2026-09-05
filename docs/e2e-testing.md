# Tests E2E avec Playwright

Ce document explique comment utiliser les tests End-to-End (E2E) avec Playwright dans ce projet Next.js SaaS boilerplate.

## Installation et Configuration

### Dépendances

Les dépendances suivantes sont nécessaires pour les tests E2E :

```json
{
  "devDependencies": {
    "@playwright/test": "^1.54.1"
  }
}
```

### Installation des navigateurs

Après avoir installé les dépendances, vous devez installer les navigateurs Playwright :

```bash
pnpm exec playwright install
```

Cette commande télécharge et installe les navigateurs Chromium, Firefox et WebKit nécessaires pour les tests.

## Configuration

### Fichier de configuration

Le fichier `playwright.config.ts` contient la configuration principale :

- **testDir**: `./e2e` - Répertoire des tests E2E
- **baseURL**: `http://localhost:3000` - URL de base pour les tests
- **webServer**: Configure le démarrage automatique du serveur de développement
- **Projects**: Tests sur différents navigateurs (Chrome, Firefox, Safari, Mobile)

### Structure des tests

Les tests E2E sont organisés dans le répertoire `e2e/` :

```
e2e/
├── homepage.spec.ts    # Tests de la page d'accueil
├── auth.spec.ts        # Tests d'authentification
└── ...                 # Autres tests E2E
```

## Scripts disponibles

### Scripts npm/pnpm

```bash
# Lancer tous les tests E2E
pnpm test:e2e

# Lancer les tests avec l'interface UI interactive
pnpm test:e2e:ui

# Lancer les tests avec navigateur visible (mode headed)
pnpm test:e2e:headed
```

### Options supplémentaires

```bash
# Lancer un test spécifique
pnpm test:e2e homepage.spec.ts

# Lancer les tests sur un navigateur spécifique
pnpm test:e2e --project=chromium

# Lancer les tests en mode debug
pnpm test:e2e --debug

# Générer un rapport HTML
pnpm test:e2e --reporter=html
```

## Écriture des tests

### Structure de base

```typescript
import {test, expect} from '@playwright/test'

test.describe('Ma fonctionnalité', () => {
  test('devrait faire quelque chose', async ({page}) => {
    await page.goto('/')

    // Vos assertions ici
    await expect(page.locator('h1')).toBeVisible()
  })
})
```

### Bonnes pratiques

1. **Sélecteurs robustes** : Utilisez des `data-testid` plutôt que des classes CSS
2. **Attentes explicites** : Utilisez `await expect()` pour les vérifications
3. **Navigation** : Utilisez `page.goto()` pour naviguer entre les pages
4. **Interactions** : Utilisez `page.click()`, `page.fill()`, etc.

### Exemple complet

```typescript
import {test, expect} from '@playwright/test'

test.describe('Authentification', () => {
  test('devrait permettre de se connecter', async ({page}) => {
    // Naviguer vers la page de connexion
    await page.goto('/signin')

    // Remplir le formulaire
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')

    // Soumettre le formulaire
    await page.click('button[type="submit"]')

    // Vérifier la redirection
    await expect(page).toHaveURL('/dashboard')
  })
})
```

## Débogage

### Mode debug

```bash
pnpm test:e2e --debug
```

Le mode debug permet de :

- Exécuter les tests pas à pas
- Inspecter les éléments en temps réel
- Voir les actions Playwright

### Traces et screenshots

Les traces sont automatiquement collectées lors des échecs. Pour les voir :

```bash
pnpm exec playwright show-report
```

## Commandes utiles

```bash
# Générer du code de test automatiquement
pnpm exec playwright codegen localhost:3000

# Exécuter un seul test
pnpm exec playwright test homepage.spec.ts

# Voir le rapport HTML
pnpm exec playwright show-report

# Nettoyer les artefacts
pnpm exec playwright clean
```
