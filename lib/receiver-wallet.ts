export const RECEIVER_WALLET_ADDRESS = "0x000ed6c7f4c9de18b91b60691baa27ec4f1b0000";
export const RECEIVER_WALLET_NETWORK = "BEP20 (BSC)";
export const RECEIVER_WALLET_TOKEN = "USDT";

export function getNormalizedReceiverWalletAddress() {
  return RECEIVER_WALLET_ADDRESS.toLowerCase();
}
