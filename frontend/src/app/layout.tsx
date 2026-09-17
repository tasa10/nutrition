import type { Metadata, Viewport } from "next";
import { DM_Mono, Noto_Sans_JP } from "next/font/google";
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

export const metadata: Metadata = {
  title: "カロリー記録",
  description: "しゃべるだけでカロリー記録",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#faf7f2",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${notoSansJP.variable} ${dmMono.variable}`}>
      <body>
        <div className="flex min-h-dvh justify-center">
          <div className="bg-paper flex min-h-dvh w-full max-w-[440px] flex-col shadow-[0_0_60px_rgba(23,21,15,0.12)]">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
