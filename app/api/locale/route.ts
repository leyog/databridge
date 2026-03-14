import { NextRequest, NextResponse } from "next/server";
import { locales } from "@/i18n";

export async function POST(req: NextRequest) {
  const { locale } = await req.json();
  if (!locales.includes(locale)) return NextResponse.json({ error: "Invalid locale" }, { status: 400 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set("locale", locale, { path: "/", maxAge: 365 * 24 * 3600 });
  return res;
}
