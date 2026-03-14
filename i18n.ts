import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const locales = ["en-US", "zh-CN", "ja-JP"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en-US";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = (cookieStore.get("locale")?.value as Locale) ?? defaultLocale;
  const validLocale = locales.includes(locale) ? locale : defaultLocale;

  return {
    locale: validLocale,
    messages: (await import(`./messages/${validLocale}.json`)).default,
  };
});
