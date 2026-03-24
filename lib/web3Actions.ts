 import { parseUnits } from "viem";
 
 export const USDT_BEP20_ADDRESS = "0x55dd5ee1f5360d8cdba15e16bfd81c0480067955";
 
 export const ERC20_ABI = [
   {
     type: "function",
     name: "transfer",
     stateMutability: "nonpayable",
     inputs: [
       { name: "to", type: "address" },
       { name: "value", type: "uint256" },
     ],
     outputs: [{ name: "success", type: "bool" }],
   },
   {
     type: "function",
     name: "decimals",
     stateMutability: "view",
     inputs: [],
     outputs: [{ name: "decimals", type: "uint8" }],
   },
   {
     type: "function",
     name: "balanceOf",
     stateMutability: "view",
     inputs: [{ name: "owner", type: "address" }],
     outputs: [{ name: "balance", type: "uint256" }],
   },
 ] as const;
 
 export function toUsdtUnits(amount: number, decimals = 18) {
   return parseUnits(String(amount), decimals);
 }
