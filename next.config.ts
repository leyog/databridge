import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n.ts");

const NATIVE_PACKAGES = ["imapflow", "mailparser", "nodemailer", "pdf-parse", "xlsx", "mammoth"];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  serverExternalPackages: NATIVE_PACKAGES,
};

export default withNextIntl(nextConfig);
