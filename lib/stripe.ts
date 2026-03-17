import Stripe from "stripe";

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-02-25.clover", typescript: true })
  : null as any;

export const PLANS = {
  FREE: {
    name: "Free",
    price: 0,
    priceId: null,
    seats: 1,
    jobsPerMonth: 50,
    features: ["50 jobs/month", "2 templates", "Email support"],
  },
  PRO: {
    name: "Professional",
    price: 20,
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    seats: -1, // per seat
    jobsPerMonth: -1, // unlimited
    trialDays: 14,
    features: ["Unlimited jobs", "Unlimited templates", "Webhook integration", "Priority support", "14-day free trial"],
  },
  ENTERPRISE: {
    name: "Enterprise",
    price: 25,
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID,
    seats: -1,
    jobsPerMonth: -1,
    features: ["Everything in Pro", "SSO / SAML", "Custom AI models", "SLA guarantee", "Dedicated support"],
  },
} as const;
