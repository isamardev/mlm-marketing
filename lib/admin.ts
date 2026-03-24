export const ADMIN_WALLET_ADDRESS = "0x000ed6c7f4c9de18b91b60691baa27ec4f1b0000";

export function isAdminAddress(addr?: string | null) {
  if (!addr) return false;
  return addr.toLowerCase() === ADMIN_WALLET_ADDRESS.toLowerCase();
}
