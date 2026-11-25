import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

const sans = Montserrat({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans-family",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: { default: "ŽA-JO KOMERC — proizvodnja čarapa, Kruševac", template: "%s · ŽA-JO" },
  description: "Pamučne čarape i hulahopi proizvođača ŽA-JO KOMERC iz Kruševca.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sr" suppressHydrationWarning data-scroll-behavior="smooth" className={`${sans.variable} h-full`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.lang=location.pathname==='/en'||location.pathname.startsWith('/en/')?'en':'sr'",
          }}
        />
      </head>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
