"use client";
import { useState } from "react";
import { toast } from "react-toastify";
import { useAccount, useWriteContract } from "wagmi";
import { useWaitForTransactionReceipt } from "wagmi";
import { toUsdtUnits, USDT_BEP20_ADDRESS, ERC20_ABI } from "@/lib/web3Actions";
import { ADMIN_WALLET_ADDRESS } from "@/lib/admin";

export default function DepositButton({ amount = 10, userId = "", fullWidth = false, label = "Pay From Wallet" }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [txHash, setTxHash] = useState(null);
  const { data: receipt, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash ?? undefined,
  });

  const onClick = async () => {
    setLoading(true);
    setError("");
    try {
      if (!isConnected) {
        setError("Connect wallet first");
        toast.error("Connect wallet first");
        setLoading(false);
        return;
      }
      const adminAddress = ADMIN_WALLET_ADDRESS;
      const value = toUsdtUnits(Number(amount), 18);
      toast.info("Sending USDT...");
      const hash = await writeContractAsync({
        address: USDT_BEP20_ADDRESS,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [adminAddress, value],
      });
      console.log("USDT transfer hash:", hash);
      toast.success("Deposit transaction sent");
      setTxHash(hash);
    } catch {
      setError("Transaction failed");
      toast.error("Transaction failed");
      setLoading(false);
    }
  };

  if (isSuccess && receipt?.status === "success" && txHash && userId && !loading) {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/verify-deposit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactionHash: txHash, amount, userId }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(typeof data?.error === "string" ? data.error : "Verification failed");
          toast.error(typeof data?.error === "string" ? data.error : "Verification failed");
          setLoading(false);
          return;
        }
        toast.success("Deposit verified and commissions distributed");
      } catch {
        setError("Verification failed");
        toast.error("Verification failed");
      } finally {
        setLoading(false);
      }
    })();
  }

  const verifying = !!txHash && !isSuccess && loading;
  return (
    <div className="grid gap-2 w-full">
      <button
        type="button"
        onClick={onClick}
        disabled={loading || !isConnected}
        className={`inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-medium text-white shadow-sm ring-1 ring-primary/20 transition hover:bg-primary/90 disabled:opacity-60 ${fullWidth ? "w-full" : ""}`}
      >
        {loading
          ? (verifying ? "Waiting for confirmation..." : (isSuccess ? "Verifying on Blockchain..." : "Depositing..."))
          : (isConnected ? label : "Connect Wallet")}
      </button>
      {error ? (
        <div className="rounded-2xl bg-muted p-3 text-xs text-subtext ring-1 ring-ring">
          {error}
        </div>
      ) : null}
    </div>
  );
}
