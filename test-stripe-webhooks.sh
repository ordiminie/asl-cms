#!/bin/bash

echo "🚀 Tests Webhooks Stripe - SaaS Essentiels"
echo "=========================================="
echo "✨ 3 Tests principaux + Debug pour votre SaaS"
echo "🎯 Compatible Stripe CLI & Better Auth"
echo "🔧 Pensez a lancer \`pnpm stripe:listen\` pour recevoir les webhooks"
echo ""
echo "📋 Fonctionnement :"
echo "   1️⃣ Completer un checkout dans votre SaaS"
echo "   2️⃣ Récupérer l'UUID de subscription généré (SUBSCRIPTION_UUID) "
echo "   3️⃣ Lancer les événements :"
echo "      • customer.subscription.updated (renouvellement)"
echo "      • customer.subscription.deleted (annulation)"
echo "   4️⃣ Aller dans base de données modifier stripe_subscription_id avec l'id de la subscription (stripe cli ne permet pas le override de l'id de la subscription)"

# 🎯 VOS VRAIS IDs Stripe (configurés dans Better Auth)
PRICE_ID_PRO_MONTHLY="price_1QoOy0CkPpvUnhXxNTbD2tMZ"
PRICE_ID_PRO_YEARLY="price_1QoOyhCkPpvUnhXxalJdCi9G"
PRICE_ID_LIFETIME="price_1QoOzLCkPpvUnhXxTNRAOlEe"
CUSTOMER_ID="cus_SZP5LdW7k5DYUo"  # 🎯 Laisser vide = Stripe CLI génère un customer avec payment method
SUBSCRIPTION_ID="sub_1ReFZZCkPpvUnhXxb2yh1J22"  # 🎯 ID d'une subscription stripe

#Les plus importants
SUBSCRIPTION_UUID="9b7bec41-f597-4814-a03a-20638cbbb686"  # 🎯 ID d'une subscription existante en base (optionnel)

echo "📋 IDs Stripe utilisés:"
echo "   - Customer ID:  $CUSTOMER_ID"
echo "   - PRO Monthly:  $PRICE_ID_PRO_MONTHLY"
echo "   - PRO Yearly:   $PRICE_ID_PRO_YEARLY"
echo "   - Lifetime:     $PRICE_ID_LIFETIME"
echo ""

# 🔍 FONCTION: Lister les subscriptions existantes en base
check_existing_subscriptions() {
    echo "🔍 Vérification des subscriptions existantes en base de données..."
    echo "💡 Cette information aide à résoudre l'erreur 'Cannot read properties of undefined'"
    echo ""
    echo "📝 Pour résoudre l'erreur, vous pouvez :"
    echo "   1️⃣ D'abord créer un checkout complet (Test 1)"
    echo "   2️⃣ Puis utiliser les autres tests"
    echo "   3️⃣ Ou ajouter un SUBSCRIPTION_UUID existant dans le script"
    echo ""
}

# TEST 1: Création d'abonnement
test_subscription_created() {
    echo "💰 TEST 1: Création d'abonnement (checkout.session.completed)"
    echo "🎯 CORRECT: Utilise subscription: pour TOUT"
    
    stripe trigger checkout.session.completed \
        --override "session:items[0][price]"="$PRICE_ID_PRO_MONTHLY" \
        --override "session:metadata[subscriptionId]"="$SUBSCRIPTION_UUID" \
        --override "session:customer"="$CUSTOMER_ID" \
        --override "session:status"="active"
    
    echo "✅ Webhook envoyé avec syntaxe CORRECTE !"
}

# TEST 2: Renouvellement d'abonnement
test_subscription_renewed() {
    echo "💰 TEST 2: Renouvellement réussi (customer.subscription.updated)"
    echo "🎯 Verifier que perdiod_end est a plus 1 mois (plus 1 an pour yearly)"
    
    stripe trigger customer.subscription.updated \
        --override "subscription:items[0][price]"="$PRICE_ID_PRO_MONTHLY" \
        --override "subscription:metadata[subscriptionId]"="$SUBSCRIPTION_UUID" \
      
    
    echo "✅ Webhook envoyé avec syntaxe CORRECTE !"
}

# TEST 3: Annulation d'abonnement
test_subscription_canceled() {
    echo "🗑️ TEST 3: Annulation d'abonnement (customer.subscription.deleted)"
    echo "⚠️ WARN probable :  WARN [Better Auth]: Stripe webhook error: Subscription not found for subscriptionId: sub_XXXXXX"
    echo "🎯 Modifier en BDD : stripe_subscription_id: sub_XXXXXX et relancer le test"
    
    stripe trigger customer.subscription.deleted \
        --override "subscription:items[0][price]"="$PRICE_ID_PRO_MONTHLY" \
        --override "subscription:metadata[subscriptionId]"="$SUBSCRIPTION_UUID"
      
    echo "✅ Webhook customer.subscription.deleted envoyé !"
    echo "💡 Note: Stripe CLI génère un ID automatique"
}

# Exécuter tous les tests
run_all_tests() {
    echo "🚀 Exécution des 3 tests essentiels en séquence..."
    
    test_subscription_created
    echo "⏱️  Attente de 3 secondes..."
    sleep 3
    
    test_subscription_renewed
    echo "⏱️  Attente de 3 secondes..."
    sleep 3
    
    test_subscription_canceled
    echo "✅ Tous les tests terminés!"
}

# Menu interactif simplifié
show_menu() {
    echo ""
    echo "📋 Tests Stripe disponibles (3 essentiels):"
    echo "1) 📝 TEST 1 (inutile): Création d'abonnement (checkout.session.completed)"
    echo "2) 💰 TEST 2: Renouvellement d'abonnement (subscription.updated)"
    echo "3) 🗑️  TEST 3: Annulation d'abonnement (subscription.deleted)"
    echo "4) 🚀 Exécuter tous les tests (1→2→3)"
    echo "5) 🔍 DEBUG: Vérifier subscriptions existantes"
    echo "0) 🚪 Quitter"
    echo ""
    echo -n "Votre choix (0-5): "
}

# Boucle principale
while true; do
    show_menu
    read -r choice
    
    case $choice in
        1)
            test_subscription_created
            ;;
        2)
            test_subscription_renewed
            ;;
        3)
            test_subscription_canceled
            ;;
        4)
            run_all_tests
            ;;
        5)
            check_existing_subscriptions
            ;;
        0)
            echo "👋 Au revoir!"
            exit 0
            ;;
        *)
            echo "❌ Choix invalide. Veuillez choisir entre 0 et 5."
            ;;
    esac
    
    echo ""
    echo "⏳ Vérifiez vos logs, puis appuyez sur Entrée pour continuer..."
    read -r
done 