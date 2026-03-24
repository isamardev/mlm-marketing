"use client";

import { SessionProvider } from "next-auth/react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { WagmiProvider, createConfig, http } from "wagmi";
import { bsc } from "wagmi/chains";
import { walletConnect } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const TRUST_WALLET_ID = "4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0";

export default function Providers({ children }: { children: React.ReactNode }) {
  const projectId = (process.env.NEXT_PUBLIC_PROJECT_ID || "").trim() || "49e93e5eb004c30a70f33af53edc69c9";
  const origin = typeof window !== "undefined" ? window.location.origin : "https://localhost";
  const config = createConfig({
    chains: [bsc],
    ssr: true,
    autoConnect: false,
    transports: {
      [bsc.id]: http(bsc.rpcUrls.default.http[0]),
    },
    connectors: [
      walletConnect({
        projectId,
        showQrModal: true,
        qrModalOptions: {
          enableExplorer: false,
          explorerRecommendedWalletIds: [TRUST_WALLET_ID],
          explorerExcludedWalletIds: "ALL",
          mobileWallets: [
            {
              id: TRUST_WALLET_ID,
              name: "Trust Wallet",
              links: {
                native: "trust://",
                universal: "https://link.trustwallet.com",
              },
            },
          ],
          desktopWallets: [],
          themeMode: "dark",
        },
        metadata: {
          name: "MLM Marketing",
          description: "BSC Mainnet app",
          url: "https://walletconnect.com",
          icons: [],
        },
      }),
    ],
  });
  const queryClient = new QueryClient();
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          {children}
          <ToastContainer position="top-right" autoClose={2000} hideProgressBar={false} newestOnTop closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="dark" />
        </SessionProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
