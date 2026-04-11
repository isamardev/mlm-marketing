"use client";
import { useEffect, useState } from "react";
import { FaWhatsapp } from "react-icons/fa";
import { whatsappMeUrlFromRawNumber } from "@/lib/whatsapp-url";

export default function WhatsAppButton() {
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/public/settings", { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        const url = whatsappMeUrlFromRawNumber(
          typeof data?.whatsappNumber === "string" ? data.whatsappNumber : "",
        );
        setHref(url);
      } catch {
        if (!cancelled) setHref(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-[9999] flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-all duration-300 hover:scale-110 active:scale-95 animate-bounce shadow-[#25D366]/30"
      style={{ pointerEvents: "auto" }}
      aria-label="Contact on WhatsApp"
    >
      <FaWhatsapp size={32} />
    </a>
  );
}
