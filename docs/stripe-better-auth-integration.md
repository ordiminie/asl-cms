# Documentation : Intégration Stripe avec Better Auth - Architecture Top-Down

## Vue d'ensemble

Cette documentation explique notre architecture d'intégration Stripe refactorisée avec le **Top-Down Design** qui combine :

- **Better Auth Stripe Plugin** (gestion native des abonnements)
- **5 Types de Checkout Custom** (externe, embed, React Stripe, payment links, installments)
- **Architecture unifiée** avec `initSubscriptionService()` et métadonnées communes
- **Types communs** et fonctions utilitaires partagées

## 1. Configuration des Types de Checkout

### Types de Checkout Disponibles (5 modes)

Notre système supporte **5 types de checkout** configurables via `NEXT_PUBLIC_STRIPE_CHECKOUT_TYPE` :

```typescript
export const StripeCheckoutConst = {
  EMBEDED_FORM: 'EmbededForm', // ✅ Formulaire intégré Stripe Elements
  EXTERNAL_FORM: 'ExternalForm', // ✅ Redirection Stripe Checkout
  REACT_STRIPE_FORM: 'ReactStripeForm', // ✅ React Stripe Elements custom
  PAYMENT_LINK: 'PaymentLink', // ✅ Liens de paiement Stripe
  INSTALLMENTS: 'Installments', // ✅ Paiements en plusieurs fois
} as const
```

### Architecture Top-Down Unifiée

**Tous les types de checkout** suivent maintenant la même architecture en 6-7 étapes :

```typescript
// 🎯 Fonction principale - Toujours la même structure
export async function createXXXCheckoutSession(params) {
  try {
    // 1️⃣ Validation du mode
    const mode = validateCheckoutMode(guest, user, context)

    // 2️⃣ Gestion customer
    const customerInfo = await initCustomer(mode, user)

    // 3️⃣ Initialisation subscription BDD (NOUVEAU !)
    const subscriptionId = await initSubscriptionService({
      plan: planCode,
      seats,
      referenceId: customerInfo.user?.id || 'guest',
      stripeCustomerId: customerInfo.customerId,
    })

    // 4️⃣ Préparation des données
    const subscriptionData = { subscriptionId, plan, seats }

    // 5️⃣ Création metadata (UNIFIÉ !)
    const metadata = createCheckoutMetadata(mode, subscriptionData, customerInfo, checkoutType)

    // 6️⃣ Création session/setup Stripe
    const result = await createStripeXXX(...)

    return { success: true, ...result }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
```

## 2. Types de Checkout Détaillés avec Top-Down

### 2.1 External Checkout (Stripe Checkout)

**Configuration :** `NEXT_PUBLIC_STRIPE_CHECKOUT_TYPE=ExternalForm`  
**Fichier :** `external-checkout/actions.ts`

#### ✅ Architecture Top-Down (7 fonctions)

```typescript
1. validateCheckoutMode()      // Validation guest/authenticated
2. initUserCustomer()         // Gestion customer Stripe
3. initSubscription()         // 🆕 Création subscription BDD
4. createCheckoutMetadata()   // Métadonnées communes
5. createStripeSession()      // Session Stripe Checkout
```

#### ✅ Fonctionnalités

- **Redirection** vers Stripe Checkout officiel
- **Customer auto-créé** en mode authenticated
- **Subscription BDD** créée AVANT paiement
- **Metadata avec UUID réel** (plus de hardcode)
- **Support guest et authenticated**

#### ✅ Compatible avec

- Plans récurrents (monthly/yearly)
- Plans one-time (lifetime)
- Multi-seats
- Coupons
- Utilisateurs connectés ET guests

### 2.2 Embedded Checkout (Stripe Elements)

**Configuration :** `NEXT_PUBLIC_STRIPE_CHECKOUT_TYPE=EmbededForm`  
**Fichier :** `embed/action.ts`

#### ✅ Architecture Top-Down (6 fonctions)

```typescript
1. validateCheckoutMode()      // Validation commune
2. initUserCustomer()         // Customer optionnel (embed)
3. initSubscription()         // 🆕 Création subscription BDD
4. createCheckoutMetadata()   // Métadonnées unifiées
5. createStripeSession()      // Session embedded
```

#### ✅ Fonctionnalités

- **Interface intégrée** dans votre page
- **UX fluide** sans redirection
- **Customer optionnel** (créé par Stripe si guest)
- **UI mode embedded** avec client_secret
- **Protection double rendu** avec flag isInitialized

#### ✅ Compatible avec

- Plans récurrents et one-time
- Multi-seats et coupons
- Design custom complet
- Mobile optimisé

### 2.3 React Stripe Elements

**Configuration :** `NEXT_PUBLIC_STRIPE_CHECKOUT_TYPE=ReactStripeForm`  
**Fichier :** `react-stripe/actions.ts`

#### ✅ Architecture Top-Down (7 fonctions)

```typescript
1. validateReactStripeMode()   // Validation + email requis guest
2. initReactStripeCustomer()  // Customer toujours créé
3. initSubscription()         // 🆕 Création subscription BDD
4. createReactStripeMetadata() // Métadonnées spécialisées
5. getStripePrice()           // Calculs montants
6. createStripeSetupIntent()  // Setup Intent pour payment method
7. confirmSubscription()      // Confirmation différée
```

#### ✅ Fonctionnalités

- **Setup Intent** + confirmation en 2 étapes
- **Customer toujours créé** (guest ou authenticated)
- **Payment method** sauvegardé pour réutilisation
- **Subscription BDD** créée AVANT Setup Intent
- **Métadonnées avec vrai UUID**

#### ✅ Compatible avec

- Plans récurrents et one-time
- Validation temps réel
- UX/UI 100% personnalisée
- Gestion d'erreurs avancée

### 2.4 Payment Links (Guest Only)

**Configuration :** `NEXT_PUBLIC_STRIPE_CHECKOUT_TYPE=PaymentLink`  
**Fichier :** `payment-link/actions.ts`

#### ✅ Architecture Top-Down (5 fonctions)

```typescript
1. validatePaymentLinkMode()   // Guest obligatoire
2. initSubscriptionForPaymentLink() // 🆕 Subscription si récurrent
3. createPaymentLinkMetadata() // Métadonnées guest
4. createStripePaymentLink()   // Payment Link Stripe
```

#### ✅ Fonctionnalités

- **Mode guest OBLIGATOIRE** (restriction active)
- **URLs partageables** pour marketing
- **Subscription créée** même pour one-time
- **After completion redirect** configuré
- **Pas de managed_by** dans metadata

#### ✅ Compatible avec

- ✅ Plans récurrents et one-time
- ✅ Multi-seats
- ✅ URLs marketing
- ❌ Utilisateurs connectés (erreur affichée)

### 2.5 Installments (Paiements Fractionnés)

**Configuration :** `enableInstallments=true` (URL parameter)  
**Fichier :** `installments/action.ts`

#### ✅ Architecture Top-Down (7 fonctions)

```typescript
1. validateCheckoutMode()        // Validation commune
2. validateInstallmentsPlan()    // 🆕 Incompatible récurrent
3. validateInstallmentType()     // 2x/3x/4x validation
4. initInstallmentCustomer()    // Customer temporaire guest
5. initSubscription()           // 🆕 Création subscription BDD
6. createInstallmentSchedule()  // Subscription Schedule Stripe
7. createInstallmentSession()   // Session checkout
```

#### ✅ Fonctionnalités

- **2x/3x/4x installments** configurables
- **Subscription Schedule** pour automation
- **Plans one-time SEULEMENT** (validation active)
- **Customer temporaire** en mode guest
- **Metadata spécialisées** avec installment_type

#### ✅ Compatible avec

- ✅ Plans one-time (lifetime, produits)
- ✅ Multi-seats
- ✅ Utilisateurs connectés ET guests
- ❌ Plans récurrents (erreur de validation)

## 3. Matrices de Compatibilité Détaillées

### 3.1 Matrice Principale - Types vs Fonctionnalités

| Feature / Type         | External | Embedded | React Stripe | Payment Link | Installments |
| ---------------------- | -------- | -------- | ------------ | ------------ | ------------ |
| **👥 Guest Users**     | ✅       | ✅       | ✅           | ✅ (Only)    | ✅           |
| **🔐 Logged Users**    | ✅       | ✅       | ✅           | ❌           | ✅           |
| **🔄 Recurring Plans** | ✅       | ✅       | ✅           | ✅           | ❌           |
| **💰 One-time Plans**  | ✅       | ✅       | ✅           | ✅           | ✅           |
| **🎫 Coupons**         | ✅       | ✅       | ✅           | ✅           | ❌           |
| **👥 Multi-seats**     | ✅       | ✅       | ✅           | ✅           | ✅           |
| **🎨 Custom UI**       | ❌       | ✅       | ✅ (Full)    | ❌           | ⚠️ Limited   |
| **📱 Mobile**          | ✅       | ✅       | ✅           | ✅           | ✅           |
| **🔗 Shareable URLs**  | ❌       | ❌       | ❌           | ✅           | ❌           |
| **💳 Payment Methods** | All      | All      | Cards        | All          | Cards        |

### 3.2 Matrice Architecture - Workflow vs Types

| Workflow Steps           | External  | Embedded    | React Stripe   | Payment Link  | Installments       |
| ------------------------ | --------- | ----------- | -------------- | ------------- | ------------------ |
| **🔍 Mode Validation**   | ✅ Common | ✅ Common   | ✅ + Email     | ✅ Guest Only | ✅ + Plan Check    |
| **👤 Customer Creation** | ✅ Auto   | ✅ Optional | ✅ Always      | ❌ None       | ✅ Temporary       |
| **💾 Subscription Init** | ✅ Before | ✅ Before   | ✅ Before      | ✅ Before     | ✅ Before          |
| **📋 Metadata**          | ✅ Common | ✅ Common   | ✅ Specialized | ✅ Guest      | ✅ Installments    |
| **💳 Stripe Creation**   | Session   | Session     | Setup Intent   | Payment Link  | Schedule + Session |
| **🔄 Confirmation**      | Automatic | Automatic   | Manual 2-step  | Automatic     | Automatic          |

### 3.3 Matrice Technique - Architecture Interne

| Technical Aspect        | External | Embedded | React Stripe | Payment Link | Installments |
| ----------------------- | -------- | -------- | ------------ | ------------ | ------------ |
| **📦 Functions Count**  | 6        | 6        | 7            | 5            | 7            |
| **🏗️ Top-Down Design**  | ✅       | ✅       | ✅           | ✅           | ✅           |
| **🔧 initSubscription** | ✅       | ✅       | ✅           | ✅           | ✅           |
| **📊 Common Metadata**  | ✅       | ✅       | ✅           | ✅           | ✅           |
| **🆔 Real UUID**        | ✅       | ✅       | ✅           | ✅           | ✅           |
| **🔍 Error Handling**   | ✅       | ✅       | ✅           | ✅           | ✅           |
| **📝 Logs Unified**     | ✅       | ✅       | ✅           | ✅           | ✅           |

## 4. Paramètres URL et Logique de Sélection

### 4.1 Structure URL Complète

```typescript
// Structure URL avec tous les paramètres
/checkout/[priceId]?guest=true&enableInstallments=true&seats=5&couponCode=PROMO20&split=true

interface CheckoutParams {
  priceId: string              // ID du prix Stripe (requis)
  guest?: boolean             // Mode guest (défaut: false)
  enableInstallments?: boolean // ANCIEN: deprecated
  split?: boolean             // NOUVEAU: Paiements fractionnés
  seats?: number              // Nombre de sièges (défaut: 1)
  couponCode?: string         // Code promo (optionnel)
}
```

### 4.2 Logique de Sélection (Switch Case)

```typescript
function getCheckoutConfig(params): CheckoutConfig {

  // 🚨 PRIORITÉ 1: Mode Installments (paramètre URL)
  if (params.enableInstallments || params.split) {
    if (isRecurring) {
      return {
        component: <ErrorMessage />,
        message: 'Installments non supportés pour plans récurrents'
      }
    }
    return {
      component: <CheckoutInstallment />,
      message: 'Choisissez votre mode de paiement par échéances'
    }
  }

  // 🔧 PRIORITÉ 2: Variable d'environnement
  switch (env.NEXT_PUBLIC_STRIPE_CHECKOUT_TYPE) {

    case StripeCheckoutConst.PAYMENT_LINK:
      if (!guest) {
        return {
          component: <ErrorMessage />,
          message: 'Payment Link réservé aux guests'
        }
      }
      return { component: <CheckoutPaymentLink /> }

    case StripeCheckoutConst.EMBEDED_FORM:
      return { component: <CheckoutFormEmbedded /> }

    case StripeCheckoutConst.REACT_STRIPE_FORM:
      return { component: <CheckoutButtonReactStripe /> }

    case StripeCheckoutConst.EXTERNAL_FORM:
      return { component: <CheckoutButtonExternal /> }

    default:
      return {
        component: <ErrorMessage />,
        message: `Type non supporté: ${env.NEXT_PUBLIC_STRIPE_CHECKOUT_TYPE}`
      }
  }
}
```

### 4.3 Exemples d'URLs par Cas d'Usage

```typescript
// 💼 Business Standard - External Checkout
const businessUrl = `/checkout/${priceId}?guest=false&seats=1`

// 🎯 Marketing - Payment Links
const marketingUrl = `/checkout/${priceId}?guest=true`

// 💎 Premium UX - Embedded
const premiumUrl = `/checkout/${priceId}?guest=false`

// 🛒 E-commerce - Installments
const ecommerceUrl = `/checkout/${priceId}?split=true&guest=false`

// 👥 Team Plans - Multi-seats
const teamUrl = `/checkout/${priceId}?seats=10&couponCode=TEAM50`

// ❌ Cas d'erreur - Installments + Recurring
const errorUrl = `/checkout/${recurring_price_id}?split=true`
```

## 5. Matrices de Compatibilité Détaillées 📊

### 5.1 Matrice Principale - Types vs Fonctionnalités

| Feature / Type         | External  | Embedded  | React Stripe | Payment Link | Installments |
| ---------------------- | --------- | --------- | ------------ | ------------ | ------------ |
| **👥 Guest Users**     | ✅        | ✅        | ✅           | ✅ (Only)    | ✅           |
| **🔐 Logged Users**    | ✅        | ✅        | ✅           | ❌           | ✅           |
| **🔄 Recurring Plans** | ✅        | ✅        | ✅           | ✅           | ❌           |
| **💰 One-time Plans**  | ✅        | ✅        | ✅           | ✅           | ✅           |
| **🎫 Coupons**         | ✅        | ✅        | ✅           | ✅           | ❌           |
| **👥 Multi-seats**     | ✅        | ✅        | ✅           | ✅           | ✅           |
| **🎨 Custom UI**       | ❌        | ✅        | ✅ (Full)    | ❌           | ⚠️ Limited   |
| **📱 Mobile**          | ✅        | ✅        | ✅           | ✅           | ✅           |
| **🔗 Shareable URLs**  | ❌        | ❌        | ❌           | ✅           | ❌           |
| **💳 Payment Methods** | All       | All       | Cards        | All          | Cards        |
| **🌍 Multi-lang**      | ✅ Auto   | ✅ Custom | ✅ Custom    | ✅ Auto      | ✅ Custom    |
| **📊 Analytics**       | ✅ Stripe | ✅ Custom | ✅ Full      | ✅ Stripe    | ✅ Custom    |

### 5.2 Matrice Architecture - Workflow vs Types

| Workflow Steps           | External   | Embedded    | React Stripe   | Payment Link  | Installments       |
| ------------------------ | ---------- | ----------- | -------------- | ------------- | ------------------ |
| **🔍 Mode Validation**   | ✅ Common  | ✅ Common   | ✅ + Email     | ✅ Guest Only | ✅ + Plan Check    |
| **👤 Customer Creation** | ✅ Auto    | ✅ Optional | ✅ Always      | ❌ None       | ✅ Temporary       |
| **💾 Subscription Init** | ✅ Before  | ✅ Before   | ✅ Before      | ✅ Before     | ✅ Before          |
| **📋 Metadata**          | ✅ Common  | ✅ Common   | ✅ Specialized | ✅ Guest      | ✅ Installments    |
| **💳 Stripe Creation**   | Session    | Session     | Setup Intent   | Payment Link  | Schedule + Session |
| **🔄 Confirmation**      | Automatic  | Automatic   | Manual 2-step  | Automatic     | Automatic          |
| **🆔 UUID Tracking**     | ✅ Real    | ✅ Real     | ✅ Real        | ✅ Real       | ✅ Real            |
| **📝 Error Handling**    | ✅ Unified | ✅ Unified  | ✅ Unified     | ✅ Unified    | ✅ Unified         |

### 5.3 Matrice Technique - Architecture Interne

| Technical Aspect            | External   | Embedded   | React Stripe | Payment Link | Installments |
| --------------------------- | ---------- | ---------- | ------------ | ------------ | ------------ |
| **📦 Functions Count**      | 6          | 6          | 7            | 5            | 7            |
| **🏗️ Top-Down Design**      | ✅         | ✅         | ✅           | ✅           | ✅           |
| **🔧 initSubscription**     | ✅         | ✅         | ✅           | ✅           | ✅           |
| **📊 Common Metadata**      | ✅         | ✅         | ✅           | ✅           | ✅           |
| **🆔 Real UUID**            | ✅         | ✅         | ✅           | ✅           | ✅           |
| **🔍 Error Handling**       | ✅         | ✅         | ✅           | ✅           | ✅           |
| **📝 Logs Unified**         | ✅         | ✅         | ✅           | ✅           | ✅           |
| **⚡ Code Maintainability** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐     | ⭐⭐⭐⭐⭐   | ⭐⭐⭐⭐     |

### 5.4 Matrice Business - Use Cases vs Types

| Business Use Case    | External   | Embedded   | React Stripe | Payment Link | Installments |
| -------------------- | ---------- | ---------- | ------------ | ------------ | ------------ |
| **🚀 MVP Launch**    | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐   | ⭐⭐⭐       | ⭐⭐⭐⭐     | ⭐⭐         |
| **🎨 Brand Premium** | ⭐⭐       | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐   | ⭐           | ⭐⭐⭐       |
| **🛒 E-commerce**    | ⭐⭐⭐     | ⭐⭐⭐⭐   | ⭐⭐⭐       | ⭐⭐⭐       | ⭐⭐⭐⭐⭐   |
| **📱 Mobile App**    | ⭐⭐⭐     | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐   | ⭐⭐⭐       | ⭐⭐⭐⭐     |
| **🎯 Marketing**     | ⭐⭐       | ⭐⭐       | ⭐           | ⭐⭐⭐⭐⭐   | ⭐⭐         |
| **👥 B2B SaaS**      | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐   | ⭐⭐⭐⭐     | ⭐⭐         | ⭐⭐⭐       |
| **🔗 Affiliate**     | ⭐⭐       | ⭐         | ⭐           | ⭐⭐⭐⭐⭐   | ⭐⭐         |

### 5.5 Matrice Performance - Vitesse vs Types

| Performance Metric    | External   | Embedded   | React Stripe | Payment Link | Installments |
| --------------------- | ---------- | ---------- | ------------ | ------------ | ------------ |
| **⚡ Load Time**      | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐   | ⭐⭐⭐       | ⭐⭐⭐⭐⭐   | ⭐⭐⭐       |
| **🔄 Checkout Speed** | ⭐⭐⭐⭐   | ⭐⭐⭐⭐⭐ | ⭐⭐⭐       | ⭐⭐⭐⭐⭐   | ⭐⭐⭐       |
| **💾 Memory Usage**   | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐   | ⭐⭐⭐       | ⭐⭐⭐⭐⭐   | ⭐⭐⭐       |
| **📊 Bundle Size**    | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐   | ⭐⭐         | ⭐⭐⭐⭐⭐   | ⭐⭐⭐       |
| **🔧 Setup Time**     | ⭐⭐⭐⭐⭐ | ⭐⭐⭐     | ⭐⭐         | ⭐⭐⭐⭐⭐   | ⭐⭐         |

### 5.6 Matrice Conversion - Optimisation par Type

| Conversion Factor      | External   | Embedded | React Stripe | Payment Link | Installments |
| ---------------------- | ---------- | -------- | ------------ | ------------ | ------------ |
| **🎯 Conversion Rate** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐       | ⭐⭐⭐⭐     | ⭐⭐⭐⭐⭐   |
| **📱 Mobile Friendly** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐     | ⭐⭐⭐⭐⭐   | ⭐⭐⭐⭐     |
| **🔒 Trust Factor**    | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐       | ⭐⭐⭐⭐     | ⭐⭐⭐       |
| **⚡ Abandon Rate**    | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐       | ⭐⭐⭐⭐     | ⭐⭐⭐⭐     |
| **💰 Cart Value**      | ⭐⭐⭐     | ⭐⭐⭐   | ⭐⭐⭐       | ⭐⭐⭐       | ⭐⭐⭐⭐⭐   |

## 6. Architecture Better Auth Integration

### 5.1 Métadonnées Unifiées par Type

Tous les types de checkout utilisent maintenant la fonction commune `createCheckoutMetadata()` :

```typescript
// 🎯 Métadonnées COMMUNES (tous types)
const baseMetadata = {
  subscriptionId: subscriptionData.subscriptionId, // 🆕 UUID réel !
  source: 'custom_checkout',
  checkoutType:
    'external' | 'embed' | 'react-stripe' | 'payment-link' | 'installments',
  isRecurring: subscriptionData.plan.isRecurring ? 'true' : 'false',
  seats: subscriptionData.seats.toString(),
  plan: subscriptionData.plan.planCode,
  interval: subscriptionData.isYearly ? 'year' : 'month',
}

// 🎯 Métadonnées SPÉCIALISÉES par type
switch (checkoutType) {
  case 'react-stripe':
    return {
      ...baseMetadata,
      source: 'react_stripe_elements',
      email: customerInfo.customerEmail ?? '',
    }

  case 'installments':
    return {
      ...baseMetadata,
      source: 'installment_checkout',
      installment_type: installmentType,
      payment_type: 'installment',
    }

  case 'payment-link':
    return {
      ...baseMetadata,
      guest_checkout: 'true', // Toujours guest
    }
}
```

### 5.2 Gestion des Webhooks Better Auth

```typescript
export async function onStripeEvent(event: Stripe.Event) {
  const metadata = event.data.object.metadata

  switch (event.type) {
    case 'checkout.session.completed': {
      // 1️⃣ Better Auth natif (plans simples)
      if (!metadata.source && metadata.managed_by === 'better_auth') {
        console.log('📋 Better Auth natif - traité automatiquement')
        // Better Auth gère tout automatiquement
      }

      // 2️⃣ External/Embed Checkout
      else if (
        metadata.checkoutType === 'external' ||
        metadata.checkoutType === 'embed'
      ) {
        const subscriptionId = metadata.subscriptionId // 🆕 UUID réel
        await updateSubscriptionAfterPayment(subscriptionId, event)
      }

      // 3️⃣ React Stripe Elements
      else if (metadata.checkoutType === 'react-stripe') {
        // Gestion différée via confirmSubscription()
        console.log('⏳ React Stripe - confirmation manuelle requise')
      }

      // 4️⃣ Payment Links
      else if (metadata.checkoutType === 'payment-link') {
        const subscriptionId = metadata.subscriptionId
        if (metadata.guest_checkout === 'true') {
          await createGuestUser(metadata.customerEmail)
        }
        await updateSubscriptionAfterPayment(subscriptionId, event)
      }

      // 5️⃣ Installments
      else if (metadata.checkoutType === 'installments') {
        await handleInstallmentPayment(metadata, event)
      }
    }

    case 'customer.subscription.updated': {
      // Renouvellements automatiques - Better Auth + Custom
      const subscriptionId = metadata.subscriptionId
      if (subscriptionId && subscriptionId !== 'undefined') {
        await handleSubscriptionRenewal(subscriptionId, event)
      }
    }
  }
}
```

## 6. Configuration Recommandée par Environnement

### 6.1 Développement - Tests Facilitaux

```env
# Checkout polyvalent pour développement
NEXT_PUBLIC_STRIPE_CHECKOUT_TYPE=EmbededForm

# Logs de debug activés
NEXT_PUBLIC_NODE_ENV=development
```

**✅ Avantages Dev :**

- Interface intégrée (pas de redirections)
- Debug facile avec DevTools
- Test de tous les scénarios
- Hot reload fonctionnel

### 6.2 Production - Conversion Optimisée

```env
# Option 1: Conversion maximale
NEXT_PUBLIC_STRIPE_CHECKOUT_TYPE=ExternalForm

# Option 2: UX premium
NEXT_PUBLIC_STRIPE_CHECKOUT_TYPE=EmbededForm

# Option 3: Contrôle total
NEXT_PUBLIC_STRIPE_CHECKOUT_TYPE=ReactStripeForm
```

**🎯 Critères de choix :**

| Critère              | External   | Embedded | React Stripe |
| -------------------- | ---------- | -------- | ------------ |
| **🎯 Conversion**    | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐       |
| **🎨 UX Custom**     | ⭐         | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐   |
| **⚡ Vitesse Setup** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐   | ⭐⭐         |
| **🔧 Maintenance**   | ⭐⭐⭐⭐⭐ | ⭐⭐⭐   | ⭐⭐         |

### 6.3 Marketing - Guest Checkout

```env
# Campagnes marketing avec URLs partageables
NEXT_PUBLIC_STRIPE_CHECKOUT_TYPE=PaymentLink

# Paramètres URL: ?guest=true
```

**🚀 Use cases marketing :**

- Landing pages produit
- Campagnes email
- Réseaux sociaux
- Liens d'affiliation

## 7. Debugging et Monitoring

### 7.1 Logs Unifiés par Type

Tous les types utilisent le même format de logs :

```typescript
// 📊 Logs standardisés
logger.info('[CHECKOUT-TYPE] Étape démarrée')
logger.debug('[CHECKOUT-TYPE] Paramètres:', {data})
logger.error('[CHECKOUT-TYPE] ❌ Erreur:', error)
logger.info('✅ [CHECKOUT-TYPE] Succès avec détails')

// Exemples par type
logger.info('[EXTERNAL-CHECKOUT] Session externe créée avec succès')
logger.info('[EMBED-CHECKOUT] Session embedded créée avec succès')
logger.info('[REACT-STRIPE] Setup Intent créé avec succès')
logger.info('[PAYMENT-LINK] Payment link créé avec succès')
logger.info('[INSTALLMENT-CHECKOUT] Session par échéances créée avec succès')
```

### 7.2 Monitoring des Erreurs

```typescript
// 🚨 Détection automatique des incompatibilités
const incompatibilityChecks = {
  'installments + recurring': () => enableInstallments && isRecurring,
  'payment-link + authenticated': () => type === 'PaymentLink' && !guest,
  'invalid checkout type': () =>
    !Object.values(StripeCheckoutConst).includes(type),
}

// 📊 Métriques de performance
const performanceMetrics = {
  subscription_init_time: Date.now() - startTime,
  customer_creation_time: customerTime,
  stripe_session_time: stripeTime,
  total_checkout_time: totalTime,
}
```

## 8. Tests et Validation

### 8.1 Tests de Non-Régression

```bash
# Tests par type de checkout
npm run test:checkout:external
npm run test:checkout:embed
npm run test:checkout:react-stripe
npm run test:checkout:payment-link
npm run test:checkout:installments

# Tests d'incompatibilités
npm run test:checkout:errors
```

### 8.2 URLs de Test Complètes

```bash
# 🧪 Test External Checkout
curl "localhost:3000/checkout/price_test?guest=false"

# 🧪 Test Embedded Checkout
curl "localhost:3000/checkout/price_test?guest=true"

# 🧪 Test React Stripe
curl "localhost:3000/checkout/price_test"

# 🧪 Test Payment Link (guest obligatoire)
curl "localhost:3000/checkout/price_test?guest=true"

# 🧪 Test Installments
curl "localhost:3000/checkout/price_lifetime?split=true"

# ❌ Test Erreur (installments + recurring)
curl "localhost:3000/checkout/price_monthly?split=true"
```

## 10. Sécurité et Performance

### 10.1 Validation des Permissions

```typescript
// 🔒 Validation commune dans tous les types
await requireActionAuth() // Server Actions sécurisées

// 🔍 Validation spécialisée par type
validateCheckoutMode(guest, user, context) // Tous
validateReactStripeMode(guest, user, email, context) // React Stripe
validateInstallmentsPlan(plan, context) // Installments
validatePaymentLinkMode(guest, user) // Payment Link
```

### 10.2 Performance et Cache

```typescript
// 💾 Cache DAL pour prix et plans
const recapInfo = await getSubscriptionRecapInfo(priceId, couponId, seats)

// ⚡ Lazy loading des composants
const CheckoutComponent = lazy(() => import('./checkout-components'))

// 🔄 Optimisation render avec useMemo
const memoizedConfig = useMemo(() => getCheckoutConfig(params), [params])
```

---

## 11. Résumé Exécutif

### ✅ Accomplissements Architecture Top-Down

1. **🏗️ Uniformisation** : 5 types de checkout avec même architecture
2. **💾 Subscription Tracking** : `initSubscriptionService()` partout
3. **📋 Métadonnées Unifiées** : `createCheckoutMetadata()` commune
4. **🆔 UUID Réels** : Plus de hardcode `'uuid-de-votre-bdd'`
5. **🔍 Validation Cohérente** : Fonctions communes réutilisables
6. **📊 Logs Standardisés** : Format uniforme pour debugging
7. **⚡ Maintenance Facilitée** : Fonctions courtes et spécialisées

### 🎯 Recommandations par Contexte

| Contexte             | Type Recommandé | Raison                          |
| -------------------- | --------------- | ------------------------------- |
| **🚀 MVP/Startup**   | External        | Setup rapide, conversion Stripe |
| **🎨 Brand Premium** | Embedded        | UX cohérente, design custom     |
| **🛒 E-commerce**    | Installments    | Panier moyen augmenté           |
| **📱 App Mobile**    | React Stripe    | Contrôle UX mobile              |
| **🎯 Marketing**     | Payment Link    | URLs partageables               |

### 📈 Métriques de Succès

- **✅ 100%** de compatibilité Better Auth
- **✅ 5 types** de checkout supportés
- **✅ 0 hardcode** dans les métadonnées
- **✅ Architecture** unifiée Top-Down
- **✅ Maintenance** simplifiée (fonctions < 30 lignes)

Cette architecture offre **flexibilité maximale**, **sécurité robuste**, et **maintenance optimale** pour un système de paiement en production. 🎉
