import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { Header } from "@/components/layout/Header";
import { ErrorBoundary } from "@/components/feedback/ErrorBoundary";
import { APP_NAME, APP_DESCRIPTION } from "@/lib/constants";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <WalletProvider>
          <div className="relative min-h-screen">
            {/* Animated gradient background */}
            <div className="fixed inset-0 -z-10">
              <div className="absolute inset-0 bg-black" />
              <div className="absolute inset-0 animated-gradient opacity-30" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-whale-900/20 via-transparent to-transparent" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-vault-900/20 via-transparent to-transparent" />
            </div>

            <Header />

            <main className="pt-28 pb-16 px-4">
              <div className="max-w-7xl mx-auto">
                <ErrorBoundary>{children}</ErrorBoundary>
              </div>
            </main>
          </div>

          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "rgba(15, 23, 42, 0.95)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "white",
              },
            }}
          />
        </WalletProvider>
      </body>
    </html>
  );
}
