import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (e: any) {
    return NextResponse.json({ error: `Webhook error: ${e.message}` }, { status: 400 });
  }

  const getOrgId = (obj: any) => obj?.metadata?.orgId as string | undefined;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as any;
      const orgId = getOrgId(session);
      if (!orgId || !session.subscription) break;

      const sub = await stripe.subscriptions.retrieve(session.subscription as string);
      const plan = (sub.metadata?.plan ?? "PRO") as "PRO" | "ENTERPRISE";

      await prisma.subscription.upsert({
        where: { orgId },
        create: {
          orgId,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: sub.id,
          stripePriceId: sub.items.data[0]?.price.id,
          plan,
          status: sub.status === "trialing" ? "TRIALING" : "ACTIVE",
          seats: sub.items.data[0]?.quantity ?? 1,
          trialEndsAt: (sub as any).trial_end ? new Date((sub as any).trial_end * 1000) : null,
          currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
        },
        update: {
          stripeSubscriptionId: sub.id,
          stripePriceId: sub.items.data[0]?.price.id,
          plan,
          status: sub.status === "trialing" ? "TRIALING" : "ACTIVE",
          seats: sub.items.data[0]?.quantity ?? 1,
          trialEndsAt: (sub as any).trial_end ? new Date((sub as any).trial_end * 1000) : null,
          currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
        },
      });
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as any;
      if (!invoice.subscription) break;
      const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
      const orgId = getOrgId(sub);
      if (!orgId) break;
      await prisma.subscription.updateMany({
        where: { orgId },
        data: { status: "ACTIVE", currentPeriodEnd: new Date((sub as any).current_period_end * 1000) },
      });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as any;
      if (!invoice.subscription) break;
      const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
      const orgId = getOrgId(sub);
      if (!orgId) break;
      await prisma.subscription.updateMany({ where: { orgId }, data: { status: "PAST_DUE" } });
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as any;
      const orgId = getOrgId(sub);
      if (!orgId) break;
      await prisma.subscription.updateMany({
        where: { orgId },
        data: { plan: "FREE", status: "CANCELED", stripeSubscriptionId: null },
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
