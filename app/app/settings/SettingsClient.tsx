"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { User, Building, CreditCard, Globe } from "lucide-react";

interface Props {
  user: { name?: string | null; email?: string | null; image?: string | null };
  org: { id: string; name: string };
  subscription: { plan: string; status: string; currentPeriodEnd: Date | null; trialEndsAt: Date | null } | null;
  role: string;
}

const LOCALES = [
  { value: "en-US", label: "English" },
  { value: "zh-CN", label: "中文" },
  { value: "ja-JP", label: "日本語" },
];

const PLAN_COLOR: Record<string, string> = {
  FREE: "bg-gray-100 text-gray-600",
  PRO: "bg-blue-100 text-blue-700",
  ENTERPRISE: "bg-purple-100 text-purple-700",
};

export default function SettingsClient({ user, org, subscription, role }: Props) {
  const [tab, setTab] = useState<"profile" | "org" | "billing" | "language">("profile");
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const plan = subscription?.plan ?? "FREE";

  const handleUpgrade = async (planId: string) => {
    setUpgrading(planId);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, seats: 1 }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else { alert("Failed to create checkout session"); setUpgrading(null); }
  };

  const handleLocaleChange = async (locale: string) => {
    await fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    });
    window.location.reload();
  };

  const tabs = [
    { key: "profile", label: "Profile", icon: User },
    { key: "org", label: "Organization", icon: Building },
    { key: "billing", label: "Billing", icon: CreditCard },
    { key: "language", label: "Language", icon: Globe },
  ] as const;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Settings</h1>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {/* Profile */}
      {tab === "profile" && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Profile</h2>
          <div className="flex items-center gap-4">
            {user.image ? (
              <img src={user.image} alt="" className="w-14 h-14 rounded-full" />
            ) : (
              <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center text-xl font-bold text-blue-600">
                {user.name?.[0] ?? user.email?.[0] ?? "?"}
              </div>
            )}
            <div>
              <p className="font-semibold text-gray-800">{user.name}</p>
              <p className="text-sm text-gray-400">{user.email}</p>
            </div>
          </div>
          <p className="text-sm text-gray-400">Profile is managed via Google OAuth. Update your name and photo in your Google account.</p>
        </div>
      )}

      {/* Org */}
      {tab === "org" && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Organization</h2>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Organization Name</label>
            <p className="text-gray-800 bg-gray-50 px-3 py-2 rounded-lg text-sm">{org.name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Your Role</label>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">{role}</span>
          </div>
        </div>
      )}

      {/* Billing */}
      {tab === "billing" && (
        <div className="space-y-4">
          {/* Current plan */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Current Plan</h2>
            <div className="flex items-center justify-between">
              <div>
                <span className={`text-sm px-3 py-1 rounded-full font-semibold ${PLAN_COLOR[plan]}`}>{plan}</span>
                {subscription?.status === "TRIALING" && subscription.trialEndsAt && (
                  <p className="text-xs text-orange-500 mt-1">
                    Trial ends {new Date(subscription.trialEndsAt).toLocaleDateString()}
                  </p>
                )}
                {subscription?.currentPeriodEnd && plan !== "FREE" && (
                  <p className="text-xs text-gray-400 mt-1">
                    Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </p>
                )}
              </div>
              {plan !== "FREE" && (
                <p className="text-sm text-gray-400">
                  ${plan === "PRO" ? "20" : "25"}/user/month
                </p>
              )}
            </div>
          </div>

          {/* Upgrade options */}
          {plan === "FREE" && (
            <div className="grid grid-cols-2 gap-4">
              {[
                { id: "PRO", name: "Professional", price: "$20", desc: "Unlimited jobs + webhooks", trial: "14-day free trial" },
                { id: "ENTERPRISE", name: "Enterprise", price: "$25", desc: "SSO + custom AI + SLA", trial: null },
              ].map(p => (
                <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="font-semibold text-gray-800 mb-1">{p.name}</h3>
                  <p className="text-2xl font-bold text-gray-900 mb-1">{p.price}<span className="text-sm font-normal text-gray-400">/user/mo</span></p>
                  <p className="text-sm text-gray-400 mb-3">{p.desc}</p>
                  {p.trial && <p className="text-xs text-green-600 mb-3">✓ {p.trial}</p>}
                  <button onClick={() => handleUpgrade(p.id)} disabled={upgrading === p.id}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
                    {upgrading === p.id ? "Redirecting..." : `Upgrade to ${p.name}`}
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-400 text-center">
            Payments processed by Stripe. No refunds policy.
          </p>
        </div>
      )}

      {/* Language */}
      {tab === "language" && (
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Language Preference</h2>
          <div className="space-y-2">
            {LOCALES.map(l => (
              <button key={l.value} onClick={() => handleLocaleChange(l.value)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-colors text-left">
                <span className="font-medium text-gray-800">{l.label}</span>
                <span className="text-xs text-gray-400">{l.value}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">Your business data will not be translated.</p>
        </div>
      )}
    </div>
  );
}
