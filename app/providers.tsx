"use client";

import { useEffect, useRef } from "react";
import { SessionProvider, signOut, useSession } from "next-auth/react";
import { ToastContainer } from "react-toastify";
import { usePathname } from "next/navigation";
import "react-toastify/dist/ReactToastify.css";
import { toast } from "react-toastify";

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
  return (
    <SessionProvider refetchInterval={0} refetchOnWindowFocus>
      <SessionGuard />
      {children}
      <ToastContainer
        position="top-right"
        autoClose={2000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
    </SessionProvider>
  );
}
