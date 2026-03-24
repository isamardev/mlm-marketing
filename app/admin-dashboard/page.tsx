"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract, useSendTransaction } from "wagmi";
import { encodeFunctionData, parseAbi, parseEther } from "viem";
import { isAdminAddress, ADMIN_WALLET_ADDRESS } from "@/lib/admin";
import ConnectWallet from "@/components/ConnectWallet";

const CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000";
const CONTRACT_ABI = parseAbi([
  "function getBalance() view returns (uint256)",
  "function withdrawFees(address to) returns (bool)",
]);

export default function AdminDashboardPage() {
  const { address, isConnected } = useAccount();
  const isAdmin = useMemo(() => isAdminAddress(address), [address]);
  const [users, setUsers] = useState<Array<{ id: string; username: string; email: string; walletAddress: string; status: string; downlineCount: number }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const { data: contractBalance } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: "getBalance",
    query: { enabled: isAdmin },
  });

  const { sendTransactionAsync } = useSendTransaction();

  useEffect(() => {
    if (!isAdmin) return;
    const run = async () => {
      try {
        setLoadingUsers(true);
        const url = `/api/admin-wallet/users?address=${encodeURIComponent(address || "")}`;
        const res = await fetch(url);
        if (!res.ok) {
          setUsers([]);
          return;
        }
        const json = await res.json();
        setUsers(json.users || []);
      } finally {
        setLoadingUsers(false);
      }
    };
    run();
  }, [isAdmin, address]);

  const withdrawFees = async () => {
    if (!isAdmin) return;
    const data = encodeFunctionData({
      abi: CONTRACT_ABI,
      functionName: "withdrawFees",
      args: [address as `0x${string}`],
    });
    await sendTransactionAsync({
      to: CONTRACT_ADDRESS as `0x${string}`,
      value: parseEther("0"),
      data,
    });
  };

  if (!isConnected || !isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-neutral-950">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 px-8 py-10 text-center text-neutral-300">
          <div className="text-xl font-semibold">Access Denied</div>
          <div className="mt-2 text-sm">Only the Admin wallet can view this page.</div>
          <div className="mt-6 flex items-center justify-center">
            <ConnectWallet />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] bg-neutral-950 px-6 py-8 text-neutral-200">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold">Command Center</div>
            <div className="text-xs text-neutral-400">Admin Wallet: {ADMIN_WALLET_ADDRESS}</div>
          </div>
          <button
            type="button"
            onClick={withdrawFees}
            className="inline-flex h-10 items-center justify-center rounded-2xl bg-primary px-4 text-sm font-medium text-white shadow-sm ring-1 ring-primary/20 transition hover:bg-primary/90 disabled:opacity-60"
          >
            Withdraw Fees
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
            <div className="text-sm text-neutral-400">Total Contract Balance</div>
            <div className="mt-2 text-3xl font-semibold">
              {contractBalance ? `${contractBalance.toString()} wei` : "—"}
            </div>
          </div>
          <div className="md:col-span-2 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
            <div className="mb-4 text-sm text-neutral-400">Users</div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-neutral-400">
                    <th className="px-3 py-2">Username</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Wallet</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Levels</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingUsers ? (
                    <tr>
                      <td className="px-3 py-3 text-neutral-400" colSpan={5}>
                        Loading...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-neutral-400" colSpan={5}>
                        No users
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="border-t border-neutral-800">
                        <td className="px-3 py-2">{u.username}</td>
                        <td className="px-3 py-2">{u.email}</td>
                        <td className="px-3 py-2">{u.walletAddress}</td>
                        <td className="px-3 py-2">{u.status}</td>
                        <td className="px-3 py-2">{Number(u.downlineCount || 0)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
