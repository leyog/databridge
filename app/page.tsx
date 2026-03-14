import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowRight, FileText, CheckCircle, Zap, Globe, Shield, Webhook } from "lucide-react";

export default function LandingPage() {
  const t = useTranslations();

  const features = [
    { icon: Zap, key: "ai" },
    { icon: CheckCircle, key: "review" },
    { icon: Webhook, key: "webhook" },
    { icon: FileText, key: "template" },
    { icon: Globe, key: "i18n" },
    { icon: Shield, key: "secure" },
  ] as const;

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 sticky top-0 bg-white/90 backdrop-blur-sm z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg">DataBridge</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <a href="#features" className="hover:text-gray-900">{t("nav.features")}</a>
            <a href="#pricing" className="hover:text-gray-900">{t("nav.pricing")}</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">{t("nav.login")}</Link>
            <Link href="/register"
              className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              {t("nav.getStarted")}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm px-4 py-1.5 rounded-full mb-6 border border-blue-100">
          <Zap className="w-3.5 h-3.5" />
          {t("hero.badge")}
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
          {t("hero.title")}
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          {t("hero.subtitle")}
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/register"
            className="bg-blue-600 text-white px-8 py-3.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2 text-lg">
            {t("hero.cta")} <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="text-sm text-gray-400">{t("hero.ctaSub")}</p>
        </div>

        {/* Demo mockup */}
        <div className="mt-16 bg-gray-50 rounded-2xl border border-gray-200 p-6 max-w-4xl mx-auto text-left shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
            <span className="text-xs text-gray-400 ml-2">DataBridge — Invoice Parser</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-400 mb-2">📄 invoice_march.pdf</p>
              <div className="space-y-1.5">
                {["Vendor: Acme Corp", "Amount: $12,450.00", "Date: 2024-03-15", "PO#: PO-2024-0892"].map(line => (
                  <div key={line} className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">{line}</div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-400 mb-2">✅ Extracted JSON</p>
              <pre className="text-xs text-green-700 bg-green-50 p-2 rounded overflow-auto">{`{
  "vendor": "Acme Corp",
  "amount": 12450.00,
  "currency": "USD",
  "date": "2024-03-15",
  "po_number": "PO-2024-0892"
}`}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-gray-50 py-24">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{t("features.title")}</h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">{t("features.subtitle")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, key }) => (
              <div key={key} className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{t(`features.items.${key}.title`)}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{t(`features.items.${key}.desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{t("pricing.title")}</h2>
            <p className="text-lg text-gray-500">{t("pricing.subtitle")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {(["free", "pro", "enterprise"] as const).map((plan) => {
              const isPro = plan === "pro";
              return (
                <div key={plan} className={`rounded-2xl border p-8 relative ${isPro ? "border-blue-500 shadow-lg shadow-blue-100" : "border-gray-200"}`}>
                  {isPro && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-medium">
                      {t("pricing.pro.badge")}
                    </div>
                  )}
                  <h3 className="font-bold text-gray-900 text-lg mb-1">{t(`pricing.${plan}.name`)}</h3>
                  <p className="text-sm text-gray-400 mb-4">{t(`pricing.${plan}.desc`)}</p>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-bold text-gray-900">${t(`pricing.${plan}.price`)}</span>
                    {plan !== "free" && <span className="text-sm text-gray-400">{t("pricing.perUserMonth")}</span>}
                  </div>
                  <Link href={plan === "enterprise" ? "/contact" : "/register"}
                    className={`block w-full text-center py-2.5 rounded-xl font-semibold text-sm mb-6 transition-colors ${
                      isPro ? "bg-blue-600 text-white hover:bg-blue-700" : "border border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}>
                    {t(`pricing.${plan}.cta`)}
                  </Link>
                  <ul className="space-y-2.5">
                    {(t.raw(`pricing.${plan}.features`) as string[]).map((f: string) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-12">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
              <FileText className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-gray-700">DataBridge</span>
          </div>
          <p className="text-sm text-gray-400">© 2024 DataBridge. All rights reserved.</p>
          <div className="flex gap-4 text-sm text-gray-400">
            <a href="/privacy" className="hover:text-gray-600">Privacy</a>
            <a href="/terms" className="hover:text-gray-600">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
