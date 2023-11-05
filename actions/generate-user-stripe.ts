"use server";

import { authOptions } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { getUserSubscriptionPlan } from "@/lib/subscription";
import { absoluteUrl } from "@/lib/utils";
import { getServerSession } from "next-auth";
import { redirect } from 'next/navigation';

const billingUrl = absoluteUrl("/dashboard/billing")

export async function generateUserStripe(priceId: string) {
  let redirectUrl = "";

  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || !session?.user.email) {
      throw new Error("Unauthorized");
    }

    const subscriptionPlan = await getUserSubscriptionPlan(session.user.id)

    if (subscriptionPlan.isPaid && subscriptionPlan.stripeCustomerId) {
      // User on Paid Plan - Create a portal session to manage subscription.
      const stripeSession = await stripe.billingPortal.sessions.create({
        customer: subscriptionPlan.stripeCustomerId,
        return_url: billingUrl,
      })

      redirectUrl = stripeSession.url as string
    } else {
      // User on Free Plan - Create a checkout session to upgrade.
      const stripeSession = await stripe.checkout.sessions.create({
        success_url: billingUrl,
        cancel_url: billingUrl,
        payment_method_types: ["card"],
        mode: "subscription",
        billing_address_collection: "auto",
        customer_email: session.user.email,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        metadata: {
          userId: session.user.id,
        },
      })

      redirectUrl = stripeSession.url as string
    }

  // WARNING: redirect not working in try catch : https://nextjs.org/learn/dashboard-app/error-handling#adding-trycatch-to-server-actions
  // uncomment the next line for test the error page if you want else remove all comments
  // redirect(redirectUrl);
  } catch (error) {
    return { message: 'Failed to generate user stripe session' }
  }

  redirect(redirectUrl);
}