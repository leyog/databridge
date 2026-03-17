import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe, PLANS } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { planId, seats = 1 } = await req.json();
  if (!["PRO", "ENTERPRISE"].includes(planId))
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

  const membership = await prisma.orgMember.findFirst({
    where: { userId: session.user.id },
    include: { org: { include: { subscription: true } } },
  });
  if (!membership) return NextResponse.json({ error: "No org" }, { status: 403 });

  const sub = membership.org.subscription;
  const plan = PLANS[planId as keyof typeof PLANS];

  // Get or create Stripe customer
  let customerId = sub?.stripeCustomerId;
  if (!customerId || customerId.startsWith("pending_")) {
    const customer = await stripe.customers.create({
      email: session.user.email!,
      name: session.user.name ?? undefined,
      metadata: { orgId: membership.orgId, userId: session.user.id },
    });
    customerId = customer.id;
    await prisma.subscription.upsert({
      where: { orgId: membership.orgId },
      create: { orgId: membership.orgId, stripeCustomerId: customerId!, plan: "FREE", status: "ACTIVE" },
      update: { stripeCustomerId: customerId! },
    });
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card", "alipay", "wechat_pay"],
    line_items: [{
      price: plan.priceId!,
      quantity: seats,
    }],
    subscription_data: {
      trial_period_days: planId === "PRO" ? 14 : undefined,
      metadata: { orgId: membership.orgId, plan: planId },
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/settings?success=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/settings?canceled=1`,
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
