/**
 * @deprecated Cette route webhook Stripe est dépréciée.
 *
 * Utilisez plutôt le webhook intégré de Better Auth avec le plugin Stripe :
 * - Configuration automatique des webhooks
 * - Gestion unifiée des subscriptions
 * - Pas de logique métier manuelle à maintenir
 *
 * @see https://www.better-auth.com/docs/plugins/stripe
 * @see src/lib/better-auth/auth.ts pour la configuration Better Auth + Stripe
 */

import {headers} from 'next/headers'
import {NextResponse} from 'next/server'
import Stripe from 'stripe'

import {env} from '@/env'
import {stripeClient} from '@/lib/stripe/stripe-client'
import {
  createSubscriptionFromStripeService,
  isPlanExistService,
} from '@/services/facades/subscription-service-facade'
import {
  StripeWebhooks,
  SubscriptionPlan,
} from '@/services/types/domain/subscription-types'

// simple simulation de paiement unique
//stripe trigger checkout.session.completed
/*
CREATION DE SESSION DE PAIEMENT
stripe checkout sessions create \
  -d success_url="http://localhost:3000/success?redirect_status=succeeded" \
  -d cancel_url="http://localhost:3000/cancel" \
  -d mode=payment \
  -d "payment_method_types[]=card" \
  -d "line_items[0][price]=price_1QoOzLCkPpvUnhXxTNRAOlEe" \
  -d "line_items[0][quantity]=1"

*/
// ca va genere URL de chackout https://checkout.stripe.com/c/pay/cs_test_a1N7mdhpFRxhiyOpD9T79K4tUfroeJtlH4e1O55DINS5EYQpQOdKns2qZI#fidkdWxOYHwnPyd1blpxYHZxWjA0TFd3R2hGblV1c1BrbV19R3RzalJXbmI1amZ2b11%2FUGpCMG9WSW1CXWNhM1F1a25xPGBGdzU2dVw3SE5CV3w0SkhVTDA0c3NVaXBucGg2bE00cGliTEJONTUwcEJuS1JIcycpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPyd2bGtiaWBabHFgaCcpJ2BrZGdpYFVpZGZgbWppYWB3dic%2FcXdwYHgl
// on peut recup info
// stripe payment_intents retrieve pi_3QumCVCkPpvUnhXx0zHxuJ9O

/*
TRIGGER WEBHOOK simple 
stripe trigger checkout.session.completed \
  --add "checkout_session:metadata[plan]=PRO" \
  --add "checkout_session:mode=subscription" \

// TRIGGER WEBHOOK avec email
stripe trigger checkout.session.completed \
  --add "checkout_session:metadata[plan]=PRO" \
  --add "checkout_session:mode=subscription" \
  --add "checkout_session:line_items[0][price]=price_1QoOyhCkPpvUnhXxalJdCi9G" \
  --add "checkout_session:line_items[0][quantity]=1"
*/
/*
// payment unique
stripe trigger payment_intent.succeeded \
  --add "payment_intent:receipt_email=admin@example.com" \
  --add "payment_intent:metadata[plan]=lifetime" \
  --add "payment_intent:metadata[customerEmail]=admin@example.com" 

  // payment recurent
stripe trigger customer.subscription.updated \
  --add "payment_intent:receipt_email=admin@example.com" \
  --add "payment_intent:metadata[plan]=pro" \
  --add "payment_intent:metadata[customerEmail]=admin@example.com" \
  --add "payment_intent:metadata[interval]=year"
*/

// webhook secret
const endpointSecret = env.STRIPE_WEBHOOK_SECRET ?? ''

const disableWebhook = true // Réactivé temporairement

export async function POST(request: Request) {
  if (disableWebhook) {
    return NextResponse.json(
      {
        received: true,
        disableWebhook: true,
        error: 'Webhook disabled, use better-auth webhook instead',
      },
      {status: 410}
    )
  }

  const body = await request.text()

  const headersList = await headers()
  const sig = headersList.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({error: 'No signature found'}, {status: 400})
  }

  let event: Stripe.Event

  try {
    event = stripeClient.webhooks.constructEvent(body, sig, endpointSecret)
  } catch (error) {
    console.error('Webhook signature verification failed:', error)
    return NextResponse.json(
      {error: 'Webhook signature verification failed'},
      {status: 400}
    )
  }

  try {
    console.log('event.type:', event.type)
    //console.log(' event.data:', event.data)

    switch (event.type) {
      // --- SESSIONS DE PAIEMENT ---
      case StripeWebhooks.Completed: {
        console.log(' event.data:', event.data)
        const session = event.data.object as Stripe.Checkout.Session
        console.log('Processing checkout session:', {
          mode: session.mode,
          paymentStatus: session.payment_status,
          customerEmail: session.customer_details?.email,
          plan: session.metadata?.plan,
        })

        if (session.payment_status === 'paid') {
          if (session.mode === 'payment') {
            // Pour les paiements uniques, on traite immédiatement
            await handleOneTimePayment(session)
          } else if (session.mode === 'subscription') {
            console.log(
              'Subscription initiated, waiting for customer.subscription.created'
            )
            await handleSubscriptionPayment(session)
          }
        }
        break
      }

      // --- PAIEMENTS UNIQUES ---
      //case StripeWebhooks.PaymentIntentSucceeded:
      case StripeWebhooks.PaymentSuccess: {
        // not used all is in session completed
        console.log(' event.data:', event.data)
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        handlePaymentIntentSucceeded(paymentIntent)
        break
      }
      case StripeWebhooks.PaymentFailed: {
        console.log(' event.data:', event.data)
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        handlePaymentIntentFailed(paymentIntent)
        break
      }
      case 'charge.failed': {
        const charge = event.data.object as Stripe.Charge
        handleChargeFailed(charge)
        break
      }

      // --- GESTION DES ABONNEMENTS ---
      case 'customer.subscription.created': {
        console.log(' event.data:', event.data)
        const subscription = event.data.object as Stripe.Subscription
        console.log('New subscription created:', {
          subscriptionId: subscription.id,
          customerId: subscription.customer,
          status: subscription.status,
        })
        await handleSubscriptionChange(subscription)
        break
      }
      case StripeWebhooks.SubscriptionUpdated: {
        console.log(' event.data:', event.data)
        const subscription = event.data.object as Stripe.Subscription
        handleSubscriptionChange(subscription)
        break
      }
      case StripeWebhooks.SubscriptionDeleted: {
        console.log(' event.data:', event.data)
        const subscription = event.data.object as Stripe.Subscription
        handleSubscriptionCancellation(subscription)
        break
      }

      // --- GESTION DES FACTURES ---
      case 'invoice.created': {
        const invoice = event.data.object as Stripe.Invoice
        handleInvoiceCreated(invoice)
        break
      }
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        handleRecurringPayment(invoice)
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        handleFailedPayment(invoice)
        break
      }
      default: {
        console.log('Event type not handled:', event.type)
        break
      }
    }

    return NextResponse.json({received: true})
  } catch (error) {
    console.error('Error processing webhook:', error)
    return NextResponse.json(
      {error: 'Webhook processing failed'},
      {status: 500}
    )
  }
}

// Fonctions de gestion des événements
async function handleOneTimePayment(session: Stripe.Checkout.Session) {
  console.log('Processing one-time payment:', {
    customerEmail: session.customer_details?.email,
    plan: session.metadata?.plan,
    sessionId: session.id,
  })

  if (session.payment_status === 'paid') {
    const customerEmail = session.customer_details?.email
    const plan = session.metadata?.plan as SubscriptionPlan
    const yearly = session.metadata?.interval === 'year'

    if (!customerEmail || !plan) {
      console.error('Missing required metadata:', {
        customerEmail,
        plan,
      })
      return
    }
    const exist = await isPlanExistService(customerEmail, plan, 1)
    if (exist) {
      console.error('Plan already exists:', {
        customerEmail,
        plan,
      })
      return
    }
    try {
      await createSubscriptionFromStripeService(customerEmail, plan, yearly)
      console.log('Subscription created successfully for:', customerEmail)
    } catch (error) {
      console.error('Error creating subscription:', error)
      throw error
    }
  }
}
async function handleSubscriptionPayment(session: Stripe.Checkout.Session) {
  console.log('Processing subscription payment:', {
    sessionId: session.id,
    customerEmail: session.customer_details?.email,
    subscriptionId: session.subscription,
    customerId: session.customer,
  })

  if (!session.subscription) {
    console.error('No subscription ID found in session')
    return
  }

  try {
    // Récupérer les détails de l'abonnement
    const subscription = await stripeClient.subscriptions.retrieve(
      session.subscription as string
    )

    // Récupérer le client pour avoir l'email
    const customer = (await stripeClient.customers.retrieve(
      subscription.customer as string
    )) as Stripe.Customer

    const customerEmail = customer.email
    const yearly =
      subscription.items.data[0]?.price.recurring?.interval === 'year'
    const plan = session.metadata?.plan as SubscriptionPlan

    if (!customerEmail || !plan) {
      console.error('Missing required data:', {
        customerEmail,
        plan,
        metadata: session.metadata,
      })
      return
    }

    // Compatible Better Auth : créer la subscription avec stripeCustomerId
    const exist = await isPlanExistService(customerEmail, plan, 1)
    if (exist) {
      console.error('Plan already exists:', {
        customerEmail,
        plan,
      })
      return
    }
    await createSubscriptionFromStripeService(customerEmail, plan, yearly)

    console.log('Subscription created successfully for:', customerEmail)
  } catch (error) {
    console.error('Error processing subscription:', error)
    throw error
  }
}
// async function handleInitialSubscription(session: Stripe.Checkout.Session) {
//   console.log('Processing initial subscription:', {
//     customerEmail: session.customer_details?.email,
//     plan: session.metadata?.plan,
//     sessionId: session.id,
//   })
//   if (session.payment_status === 'paid') {
//     const customerEmail = session.customer_details?.email
//     const plan = session.metadata?.plan
//     // Logique pour nouveau abonnement...
//   }
// }

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const customer = (await stripeClient.customers.retrieve(
    subscription.customer as string
  )) as Stripe.Customer
  console.log('Processing subscription change:', {
    customerEmail: customer.email,
    priceId: subscription.items.data[0]?.price.id,
    status: subscription.status,
  })

  if (subscription.status === 'active') {
    const customerEmail = customer.email
    //const priceId = subscription.items.data[0]?.price.id
    //const plan = getPlanByPriceId(priceId) as SubscriptionPlan
    const plan = 'pro'
    // const yearly =
    //   subscription.items.data[0]?.price.recurring?.interval === 'year'

    if (!customerEmail || !plan) {
      console.error('Missing required data:', {
        customerEmail,
        plan,
      })
      return
    }

    // try {
    //   await createSubscriptionFromStripe(customerEmail, plan, yearly)
    //   console.log(
    //     'Subscription created/updated successfully for:',
    //     customerEmail
    //   )
    // } catch (error) {
    //   console.error('Error creating/updating subscription:', error)
    //   throw error
    // }
  }
}

async function handleSubscriptionCancellation(
  subscription: Stripe.Subscription
) {
  const customer = (await stripeClient.customers.retrieve(
    subscription.customer as string
  )) as Stripe.Customer
  console.log('Processing subscription cancellation:', {
    customerEmail: customer.email,
    subscriptionId: subscription.id,
  })
  // Logique pour annulation...
}

async function handleRecurringPayment(invoice: Stripe.Invoice) {
  console.log('Processing recurring payment:', {
    customerId: invoice.customer,
    amount: invoice.amount_paid,
    status: invoice.status,
  })
  // Gestion des paiements récurrents réussis
}

async function handleFailedPayment(invoice: Stripe.Invoice) {
  console.log('Processing failed payment:', {
    customerId: invoice.customer,
    amount: invoice.amount_due,
    status: invoice.status,
  })
  // Gestion des échecs de paiement
}

// Nouvelle fonction de gestion
async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent
) {
  console.log('Processing payment intent:', {
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    status: paymentIntent.status,
    metadata: paymentIntent.metadata,
  })

  if (paymentIntent.status === 'succeeded') {
    // Récupérer l'email depuis les métadonnées ou receipt_email
    const customerEmail =
      paymentIntent.metadata?.customerEmail || paymentIntent.receipt_email

    // Récupérer le plan depuis les métadonnées
    const plan = paymentIntent.metadata?.plan as SubscriptionPlan

    // Récupérer l'intervalle depuis les métadonnées
    //const yearly = paymentIntent.metadata?.interval === 'year'

    if (!customerEmail || !plan) {
      console.error('Missing required metadata:', {
        customerEmail,
        plan,
        metadata: paymentIntent.metadata,
      })
      return
    }
  }
}

// Nouvelle fonction de gestion
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log('Processing failed payment intent:', {
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    status: paymentIntent.status,
    lastPaymentError: paymentIntent.last_payment_error,
  })

  if (paymentIntent.status === 'requires_payment_method') {
    console.log('Payment failed:', {
      paymentIntentId: paymentIntent.id,
      customerId: paymentIntent.customer,
      errorMessage: paymentIntent.last_payment_error?.message,
    })
    // Ajouter ici la logique de traitement de l'échec (notifications, etc.)
  }
}

// Nouvelle fonction de gestion
async function handleChargeFailed(charge: Stripe.Charge) {
  console.log('Processing failed charge:', {
    chargeId: charge.id,
    amount: charge.amount,
    currency: charge.currency,
    status: charge.status,
    failureCode: charge.failure_code,
    failureMessage: charge.failure_message,
    customerId: charge.customer,
  })

  if (charge.status === 'failed') {
    // Ajouter ici la logique de traitement de l'échec (notifications, mise à jour statut, etc.)
    console.log('Charge failed details:', {
      paymentIntentId: charge.payment_intent,
      receiptEmail: charge.receipt_email,
      outcome: charge.outcome,
    })
  }
}

// Nouvelle fonction de gestion
async function handleInvoiceCreated(invoice: Stripe.Invoice) {
  console.log('Processing invoice created:', {
    invoiceId: invoice.id,
    customerId: invoice.customer,
    amount: invoice.amount_due,
    currency: invoice.currency,
    status: invoice.status,
    //subscription: invoice.subscription,
  })

  if (invoice.status === 'draft' || invoice.status === 'open') {
    console.log('New invoice details:', {
      //paymentIntent: invoice.payment_intent,
      dueDate: invoice.due_date,
      periodStart: invoice.period_start,
      periodEnd: invoice.period_end,
    })
    // Ajouter ici la logique de traitement de la nouvelle facture
  }
}
