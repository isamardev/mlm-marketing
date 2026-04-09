import { DEFAULT_RECEIVER_WALLET_ADDRESS } from "@/lib/receiver-wallet";

export const ADMIN_WALLET_ADDRESS = DEFAULT_RECEIVER_WALLET_ADDRESS;

export function isAdminAddress(addr?: string | null) {
  if (!addr) return false;
  return addr.toLowerCase() === ADMIN_WALLET_ADDRESS.toLowerCase();
}
