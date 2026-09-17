import type { Metadata, Viewport } from "next";
import { DM_Mono, Fraunces, Noto_Sans_JP } from "next/font/google";
import AuthGate from "@/components/AuthGate";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

// Display face for the wordmark only; body text stays on Noto Sans JP.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["SOFT", "opsz"],
});

export const metadata: Metadata = {
  title: "nutrition",
  description: "しゃべるだけでカロリー記録",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#faf7f2",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${notoSansJP.variable} ${dmMono.variable} ${fraunces.variable}`}>
      <body>
        <div className="flex min-h-dvh justify-center">
          <div className="bg-paper flex min-h-dvh w-full max-w-[440px] flex-col shadow-[0_0_60px_rgba(23,21,15,0.12)]">
            <AuthGate>{children}</AuthGate>
          </div>
        </div>
      </body>
    </html>
  );
}
