"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { FileText, LayoutDashboard, FileCode, Settings, LogOut, ChevronDown, BarChart2 } from "lucide-react";
import Image from "next/image";

interface Props {
  org: { id: string; name: string; subscription: { plan: string } | null };
  user: { name?: string | null; email?: string | null; image?: string | null };
}

export default function AppSidebar({ org, user }: Props) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  const nav = [
    { href: "/app", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/app/jobs", label: t("jobs"), icon: FileText },
    { href: "/app/templates", label: t("templates"), icon: FileCode },
    { href: "/app/analytics", label: "Analytics", icon: BarChart2 },
    { href: "/app/settings", label: t("settings"), icon: Settings },
  ];

  const planColor = { FREE: "bg-gray-100 text-gray-500", PRO: "bg-blue-100 text-blue-600", ENTERPRISE: "bg-purple-100 text-purple-600" };
  const plan = (org.subscription?.plan ?? "FREE") as keyof typeof planColor;

  return (
    <aside className="w-56 bg-white border-r border-gray-100 flex flex-col h-full shrink-0">
      {/* Logo */}
      <div className="p-4 border-b border-gray-100">
        <Link href="/app" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <FileText className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-sm">DataBridge</span>
        </Link>
      </div>

      {/* Org */}
      <div className="px-3 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-800 truncate">{org.name}</p>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${planColor[plan]}`}>{plan}</span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/app" && pathname.startsWith(href));
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                active ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}>
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-gray-100">
        <div className="flex items-center gap-2.5 px-2 py-2">
          {user.image ? (
            <Image src={user.image} alt="" width={28} height={28} className="rounded-full" />
          ) : (
            <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
              {user.name?.[0] ?? user.email?.[0] ?? "?"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-800 truncate">{user.name ?? user.email}</p>
            <p className="text-xs text-gray-400 truncate">{user.email}</p>
          </div>
          <button onClick={() => signOut({ callbackUrl: "/" })} className="text-gray-400 hover:text-gray-600">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
