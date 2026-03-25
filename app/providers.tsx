"use client";

import { useEffect, useRef } from "react";
import { SessionProvider, signOut, useSession } from "next-auth/react";
import { ToastContainer } from "react-toastify";
import { usePathname } from "next/navigation";
import "react-toastify/dist/ReactToastify.css";
import { WagmiProvider, createConfig, http } from "wagmi";
import { bsc } from "wagmi/chains";
import { walletConnect } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "react-toastify";

const TRUST_WALLET_ID = "4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0";
const BLOCKED_MESSAGE = "You are blocked by admin. Contact customer support for help.";

function SessionGuard() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const handledRef = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") {
      handledRef.current = false;
      return;
    }
    if (session?.user?.status !== "blocked") {
      handledRef.current = false;
      return;
    }
    if (handledRef.current) return;
    handledRef.current = true;
    toast.error(BLOCKED_MESSAGE);
    signOut({ callbackUrl: "/?blocked=1" });
  }, [pathname, session?.user?.status, status]);

  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const projectId = (process.env.NEXT_PUBLIC_PROJECT_ID || "").trim() || "49e93e5eb004c30a70f33af53edc69c9";
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const config = createConfig({
    chains: [bsc],
    ssr: true,
    transports: { [bsc.id]: http(bsc.rpcUrls.default.http[0]) },
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
              links: { native: "trust://", universal: "https://link.trustwallet.com" },
            },
          ],
          desktopWallets: [],
          themeMode: "dark",
        },
        metadata: {
          name: "MLM Marketing",
          description: "BSC Mainnet app",
          url: origin,
          icons: [],
        },
      }),
    ],
  });
  const queryClient = new QueryClient();
  return (
    <WagmiProvider config={config} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider refetchInterval={10} refetchOnWindowFocus>
          <SessionGuard />
          {children}
          <ToastContainer position="top-right" autoClose={2000} hideProgressBar={false} newestOnTop closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="dark" />
        </SessionProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
