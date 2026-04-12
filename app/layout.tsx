import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import BodyWrapper from "./BodyWrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});


const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "MLM Marketing",
    template: "%s | MLM Marketing",
  },
  description:
    "Binary MLM platform: two referral legs per member, network depth up to 33 levels, commissions on levels 1–20. Sign up, build your team, and track deposits and withdrawals.",
  icons: {
    icon: [{ url: "/logo.jpeg", type: "image/jpeg" }],
    apple: [{ url: "/logo.jpeg" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};


 
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="cryptomus" content="f0cbf466" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <BodyWrapper>
          <Providers>{children}</Providers>
        </BodyWrapper>
      </body>
    </html>
  );
}
