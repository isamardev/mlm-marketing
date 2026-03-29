"use client";
import { useEffect, useState } from "react";
import { FaWhatsapp } from "react-icons/fa";

export default function WhatsAppButton() {
  const [number, setNumber] = useState("");

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/public/settings");
        const data = await res.json();
        if (data?.whatsappNumber) {
          setNumber(data.whatsappNumber.replace(/\D/g, ""));
        }
      } catch (e) {
        console.error("Failed to fetch WhatsApp number", e);
      }
    };
    fetchSettings();
  }, []);

  if (!number) return null;

  return (
    <a
      href={`https://wa.me/${number}`}
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
