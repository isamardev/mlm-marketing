"use client";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { FaUser } from "react-icons/fa";
import DepositButton from "@/components/DepositButton.jsx";
import { toast } from "react-toastify";
import ConnectWallet from "@/components/ConnectWallet";
import { ADMIN_WALLET_ADDRESS } from "@/lib/admin";
import { useAccount } from "wagmi";

const COMPANY_ADMIN_EMAIL = "admin@example.com";

function WalletSection({ balance, userId }: { balance: number, userId: string }) {
  const [depositAmount, setDepositAmount] = useState<string>("10");
  const [step, setStep] = useState<1 | 2>(1);
  const [uiMsg, setUiMsg] = useState<string>("");
  const { isConnected } = useAccount();
  const autoPollRef = useRef<any>(null);

  useEffect(() => {
    if (step !== 2) {
      if (autoPollRef.current) {
        clearInterval(autoPollRef.current);
        autoPollRef.current = null;
      }
      return;
    }
    const poll = async () => {
      try {
        const res = await fetch(`/api/scan-deposits?userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
        const data = await res.json();
        if (res.ok && Number(data?.createdForUser || 0) > 0) {
          toast.success("Payment detected");
          clearInterval(autoPollRef.current);
          autoPollRef.current = null;
        }
      } catch {
        // silent
      }
    };
    poll();
    autoPollRef.current = setInterval(poll, 15000);
    return () => {
      if (autoPollRef.current) {
        clearInterval(autoPollRef.current);
        autoPollRef.current = null;
      }
    };
  }, [step, userId]);

  return (
    <div className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-ring">
      <div className="grid gap-6 md:grid-cols-[1fr_0.38fr]">
        {step === 1 ? (
          <div className="w-full">
            <div className="text-lg font-semibold">Deposit Funds</div>
            <div className="mt-1 text-xs text-subtext">Secure gateway payment</div>
            <div className="mt-4 grid gap-3 sm:max-w-md">
              <label className="grid gap-1">
                <span className="text-xs text-subtext">Deposit Amount (USDT)</span>
                <input
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="h-10 w-full rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="10"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-subtext">Select Network</span>
                <select
                  disabled
                  className="h-10 w-full cursor-not-allowed rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring"
                  value="bep20"
                  onChange={() => {}}
                >
                  <option value="bep20">BEP20 (BSC)</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  const amt = Number(depositAmount);
                  if (!Number.isFinite(amt) || amt < 10) {
                    setUiMsg("Minimum deposit is 10 USDT");
                    toast.error("Minimum deposit is 10 USDT");
                    return;
                  }
                  setUiMsg("");
                  setStep(2);
                }}
                className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-green-600 px-5 text-sm font-medium text-white shadow-sm ring-1 ring-green-600/20 transition hover:bg-green-700"
              >
                Proceed Payment
              </button>
              {uiMsg ? (
                <div className="rounded-2xl bg-muted p-3 text-xs text-subtext ring-1 ring-ring">{uiMsg}</div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="w-full">
            <div className="text-lg font-semibold">Payment Details</div>
            <div className="mt-1 text-xs text-subtext">Scan QR or use BEP20 address</div>
            <div className="mt-4 grid gap-3">
              <img
                alt="Deposit QR"
                src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
                  ADMIN_WALLET_ADDRESS,
                )}&size=180x180&margin=0`}
                className="mx-auto h-[160px] w-[160px] rounded-lg ring-1 ring-ring"
              />
              <div className="grid gap-2">
                <div className="text-xs font-medium text-subtext">BEP20 Address</div>
                <div className="flex items-stretch gap-2">
                  <div className="flex-1 break-all rounded-2xl bg-background p-3 text-sm font-mono ring-1 ring-ring">
                    {ADMIN_WALLET_ADDRESS}
                  </div>
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(ADMIN_WALLET_ADDRESS);
                          toast.success("Address copied");
                        } catch {
                          toast.error("Copy failed");
                        }
                      }}
                      className="inline-flex h-10 items-center justify-center rounded-2xl bg-card px-3 text-xs font-medium text-foreground ring-1 ring-ring transition hover:bg-muted"
                      aria-label="Copy address"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
              {!isConnected ? (
                <div className="mt-2">
                  <ConnectWallet
                    fullWidth
                    connectText="If you want to pay from wallet connect wallet"
                    connectedText="Connected"
                  />
                </div>
              ) : (
                <div className="mt-2">
                  <DepositButton
                    amount={Number(depositAmount) || 10}
                    userId={userId}
                    fullWidth
                    label="Pay From Wallet"
                  />
                </div>
              )}
            </div>
          </div>
        )}
        <div className="rounded-2xl bg-muted p-4 ring-1 ring-ring">
          <div className="text-sm font-semibold">Deposit Summary</div>
          <div className="mt-2 grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-subtext">Network</span>
              <span className="font-medium">BEP20 (BSC)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-subtext">Amount</span>
              <span className="font-semibold">{Number(depositAmount) || 0} USDT</span>
            </div>
          </div>
          {step === 2 && (
            <div className="mt-4 rounded-xl bg-card p-3 text-center ring-1 ring-ring">
              <div className="text-xs text-subtext">Please deposit</div>
              <div className="mt-1 text-xl font-bold">{Number(depositAmount)} USDT</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WithdrawSection() {
  const [withdrawAmount, setWithdrawAmount] = useState<string>("10");
  const [withdrawAddress, setWithdrawAddress] = useState<string>("");
  const [msg, setMsg] = useState<string>("");

  const onWithdraw = async () => {
    setMsg("");
    try {
      const amt = Number(withdrawAmount);
      if (!Number.isFinite(amt) || amt <= 0) {
        setMsg("Invalid amount");
        toast.error("Invalid amount");
        return;
      }
      if (!/^0x[a-fA-F0-9]{40}$/.test(withdrawAddress)) {
        setMsg("Invalid USDT address");
        toast.error("Invalid USDT address");
        return;
      }
      const res = await fetch("/api/user/withdraw-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, address: withdrawAddress }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(typeof data?.error === "string" ? data.error : "Withdrawal request failed");
        toast.error(typeof data?.error === "string" ? data.error : "Withdrawal request failed");
        return;
      }
      setMsg("Withdrawal requested");
      toast.success("Withdrawal requested");
    } catch {
      setMsg("Withdrawal request failed");
      toast.error("Withdrawal request failed");
    }
  };

  return (
    <div className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-ring">
      <div className="text-lg font-semibold">Withdraw Funds</div>
      <div className="mt-1 text-xs text-subtext">Send USDT (BEP20) to your address</div>
      <div className="mt-4 grid gap-3 sm:max-w-md">
        <label className="grid gap-1">
          <span className="text-xs text-subtext">Withdraw Amount (USDT)</span>
          <input
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            className="h-10 w-full rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="10"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-subtext">USDT Address (BEP20)</span>
          <input
            value={withdrawAddress}
            onChange={(e) => setWithdrawAddress(e.target.value.trim())}
            className="h-10 w-full rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="0x..."
          />
        </label>
        <button
          type="button"
          onClick={onWithdraw}
          className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-primary px-5 text-sm font-medium text-white shadow-sm ring-1 ring-primary/20 transition hover:bg-primary/90"
        >
          Withdraw
        </button>
        {msg ? <div className="rounded-2xl bg-muted p-3 text-xs text-subtext ring-1 ring-ring">{msg}</div> : null}
      </div>
    </div>
  );
}

function SettingsSection() {
  const [uiMessage, setUiMessage] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [profileData, setProfileData] = useState({
    username: "",
    email: ""
  });

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setUiMessage("New passwords do not match");
      return;
    }
    
    setIsChangingPassword(true);
    setUiMessage("");
    
    try {
      const res = await fetch("/api/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        setUiMessage(data?.error || "Password change failed");
        return;
      }
      
      setUiMessage("Password changed successfully");
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setIsChangingPassword(false);
    } catch (error) {
      setUiMessage("Password change failed");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditingProfile(true);
    setUiMessage("");
    
    try {
      const res = await fetch("/api/user/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileData),
      });
      
      const data = await res.json();
      if (!res.ok) {
        setUiMessage(data?.error || "Profile update failed");
        return;
      }
      
      setUiMessage("Profile updated successfully");
      setIsEditingProfile(false);
    } catch (error) {
      setUiMessage("Profile update failed");
    } finally {
      setIsEditingProfile(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-ring">
        <div className="text-sm font-semibold">Account Settings</div>
        
        <div className="mt-6 grid gap-4">
          <div className="flex items-center justify-between rounded-2xl bg-muted p-4 ring-1 ring-ring">
            <div>
              <div className="text-sm font-medium">Email Notifications</div>
              <div className="text-xs text-subtext">Receive updates about your account</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-ring">
        <div className="text-sm font-semibold">Profile Settings</div>
        
        {uiMessage && (
          <div className="mt-4 rounded-2xl bg-muted p-4 text-sm text-foreground ring-1 ring-ring">
            {uiMessage}
          </div>
        )}
        
        <div className="mt-6 grid gap-4">
          {!isChangingPassword ? (
            <div className="rounded-2xl bg-muted p-4 ring-1 ring-ring">
              <div className="text-sm font-medium">Update Password</div>
              <div className="mt-2 text-xs text-subtext">Change your account password</div>
              <button 
                onClick={() => setIsChangingPassword(true)}
                className="mt-3 inline-flex items-center justify-center rounded-full bg-card px-4 py-2 text-xs font-medium text-foreground ring-1 ring-ring transition hover:bg-muted"
              >
                Change Password
              </button>
            </div>
          ) : (
            <div className="rounded-2xl bg-muted p-4 ring-1 ring-ring">
              <div className="text-sm font-medium">Update Password</div>
              <form onSubmit={handlePasswordChange} className="mt-4 space-y-3">
                <input
                  type="password"
                  placeholder="Current Password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                  className="w-full rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-ring"
                  required
                />
                <input
                  type="password"
                  placeholder="New Password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                  className="w-full rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-ring"
                  required
                />
                <input
                  type="password"
                  placeholder="Confirm New Password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                  className="w-full rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-ring"
                  required
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-medium text-white ring-1 ring-primary/20 transition hover:bg-primary/90"
                  >
                    {isChangingPassword ? "Updating..." : "Update Password"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsChangingPassword(false)}
                    className="inline-flex items-center justify-center rounded-full bg-card px-4 py-2 text-xs font-medium text-foreground ring-1 ring-ring transition hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {!isEditingProfile ? (
            <div className="rounded-2xl bg-muted p-4 ring-1 ring-ring">
              <div className="text-sm font-medium">Account Information</div>
              <div className="mt-2 text-xs text-subtext">View and update your personal details</div>
              <button 
                onClick={() => setIsEditingProfile(true)}
                className="mt-3 inline-flex items-center justify-center rounded-full bg-card px-4 py-2 text-xs font-medium text-foreground ring-1 ring-ring transition hover:bg-muted"
              >
                Edit Profile
              </button>
            </div>
          ) : (
            <div className="rounded-2xl bg-muted p-4 ring-1 ring-ring">
              <div className="text-sm font-medium">Update Profile</div>
              <form onSubmit={handleProfileUpdate} className="mt-4 space-y-3">
                <input
                  type="text"
                  placeholder="Username"
                  value={profileData.username}
                  onChange={(e) => setProfileData({...profileData, username: e.target.value})}
                  className="w-full rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-ring"
                  required
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={profileData.email}
                  onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                  className="w-full rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-ring"
                  required
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isEditingProfile}
                    className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-medium text-white ring-1 ring-primary/20 transition hover:bg-primary/90"
                  >
                    {isEditingProfile ? "Updating..." : "Update Profile"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="inline-flex items-center justify-center rounded-full bg-card px-4 py-2 text-xs font-medium text-foreground ring-1 ring-ring transition hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NetworkTree({ nodes, onCopyMessage }: { nodes: any[], onCopyMessage: (message: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(800);
  
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setW(el.clientWidth || 800);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Group nodes by depth
  const nodesByDepth = useMemo(() => {
    const grouped: Record<number, any[]> = {};
    nodes.forEach(node => {
      if (!grouped[node.depth]) {
        grouped[node.depth] = [];
      }
      grouped[node.depth].push(node);
    });
    return grouped;
  }, [nodes]);

  const depths = Object.keys(nodesByDepth).map(Number).sort((a, b) => a - b);
  const maxDepth = Math.max(...depths, 0);
  
  const rowH = 84;
  const padY = 20;
  const iconSize = 24;
  
  const rows = useMemo(() => {
    const r: Array<Array<{ x: number; y: number; node: any }>> = [];
    
    for (let depth = 0; depth <= maxDepth; depth += 1) {
      const levelNodes = nodesByDepth[depth] || [];
      const y = padY + depth * rowH;
      
      const pts = levelNodes.map((node, idx) => ({
        x: Math.round(w * ((idx + 1) / (levelNodes.length + 1))),
        y,
        node
      }));
      
      r.push(pts);
    }
    
    return r;
  }, [maxDepth, nodesByDepth, w]);

  const svgW = w;
  const svgH = padY + (maxDepth + 1) * rowH + 20;
  
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  
  // Create connections between nodes
  for (let depth = 0; depth < rows.length - 1; depth += 1) {
    const parentRow = rows[depth];
    const childRow = rows[depth + 1];
    
    parentRow.forEach(parent => {
      const children = childRow.filter(child => 
        child.node.referredById === parent.node.id
      );
      
      children.forEach(child => {
        lines.push({ 
          x1: parent.x, 
          y1: parent.y + iconSize / 2, 
          x2: child.x, 
          y2: child.y - iconSize / 2 
        });
      });
    });
  }

  return (
    <div ref={ref} className="relative mt-5 w-full">
      <svg width={svgW} height={svgH} className="block" style={{ maxWidth: "100%" }}>
        {lines.map((ln, idx) => (
          <line
            key={idx}
            x1={ln.x1}
            y1={ln.y1}
            x2={ln.x2}
            y2={ln.y2}
            stroke="var(--ring)"
            strokeWidth={1.5}
          />
        ))}
      </svg>
      
      <div className="absolute inset-0">
        {rows.flatMap((row, depth) =>
          row.map((pt, idx) => (
            <div
              key={`n-${depth}-${idx}`}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: pt.x, top: pt.y }}
              title={`${pt.node.username} - L${pt.node.depth}`}
            >
              <div className="flex flex-col items-center">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 ring-1 ring-ring">
                  <FaUser className="text-foreground" size={16} />
                </div>
                <div className="mt-1 text-xs font-medium text-foreground max-w-[80px] truncate">
                  {pt.node.email === COMPANY_ADMIN_EMAIL ? "Admin" : pt.node.username}
                </div>
                <div className="text-[10px] text-subtext">
                  L{pt.node.depth}
                </div>
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const text = origin ? `${origin}/?ref=${pt.node.referrerCode}` : pt.node.referrerCode;
                    try {
                      await navigator.clipboard.writeText(text);
                      onCopyMessage(`Copied ${(pt.node.email === COMPANY_ADMIN_EMAIL ? "Admin" : pt.node.username)}'s referral link`);
                      toast.success("Referral link copied");
                    } catch {
                      onCopyMessage("Copy failed");
                      toast.error("Copy failed");
                    }
                  }}
                  className="mt-1 inline-flex items-center gap-2 rounded-full bg-card px-3 py-1 text-[10px] text-subtext ring-1 ring-ring transition hover:text-foreground"
                  title="Copy team member referral link"
                >
                  <span className="truncate max-w-[120px] sm:max-w-[200px]">{pt.node.referrerCode}</span>
                  <span className="text-primary">Copy</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {maxDepth > 7 ? (
        <div className="mt-6 rounded-2xl bg-muted p-4 ring-1 ring-ring">
          <div className="text-xs text-subtext">
            Showing {nodes.length} team members across {maxDepth + 1} levels
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl bg-card p-4 sm:p-5 shadow-sm ring-1 ring-ring">
      <div className="text-xs text-subtext">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
      {hint ? <div className="mt-2 text-sm text-subtext">{hint}</div> : null}
    </div>
  );
}

export default function UserDashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [active, setActive] = useState<"home" | "network" | "wallet" | "settings">("home");
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletTab, setWalletTab] = useState<
    "deposit" | "depositHistory" | "withdraw" | "withdrawHistory" | "p2pTransfer" | "p2pHistory"
  >("deposit");
  const [level, setLevel] = useState(6);
  const maxLevel = 33;

  const [profile, setProfile] = useState<any>(null);
  const [directReferrals, setDirectReferrals] = useState<number>(0);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [refStats, setRefStats] = useState<{ total: number; levels: Record<string, number> } | null>(null);
  const [teamNodes, setTeamNodes] = useState<any[] | null>(null);
  const [uplineNodes, setUplineNodes] = useState<any[] | null>(null);
  const [notifications, setNotifications] = useState<any[] | null>(null);
  const [unread, setUnread] = useState<number>(0);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [uiMessage, setUiMessage] = useState("");
  const [origin, setOrigin] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [openLevels, setOpenLevels] = useState<number[]>([]);

  useEffect(() => {
    const o = typeof window !== "undefined" ? window.location.origin : "";
    setOrigin(o);
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user?.id) {
      router.replace("/");
      return;
    }

    const load = async () => {
      const [dash, stats, noti, team, upline] = await Promise.all([
        fetch("/api/user/dashboard", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/user/referral-stats", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/user/notifications", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/user/my-team", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/user/upline", { cache: "no-store" }).then((r) => r.json()),
      ]);
      if (dash?.profile) {
        setProfile(dash.profile);
        setDirectReferrals(dash.directReferrals ?? 0);
        setRecentTransactions(dash.recentTransactions ?? []);
      }
      if (stats?.levels) setRefStats(stats);
      if (Array.isArray(noti?.items)) {
        setNotifications(noti.items);
        setUnread(noti.unread ?? 0);
      }
      if (team?.nodes) setTeamNodes(team.nodes);
      if (upline?.nodes) setUplineNodes(upline.nodes);
    };
    load().catch(() => setUiMessage("Failed to load dashboard data"));
  }, [router, session?.user?.id, status]);

  const networkRows = useMemo(() => {
    const rows: { level: number; count: number }[] = [];
    for (let i = 1; i <= maxLevel; i += 1) {
      rows.push({ level: i, count: refStats?.levels?.[String(i)] ?? 0 });
    }
    return rows;
  }, [refStats]);

  const activeRow = networkRows[level - 1] ?? { level, count: 0 };
  const initials = useMemo(() => {
    const name = profile?.username ?? "";
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] ?? "U";
    const b = parts[1]?.[0] ?? parts[0]?.[1] ?? "S";
    return `${a}${b}`.toUpperCase();
  }, [profile?.username]);

  return (
    <div className="min-h-screen bg-transparent text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-card shadow-sm ring-1 ring-ring hover:bg-muted lg:hidden"
              aria-label="Open menu"
            >
              ☰
            </button>
              <div className="flex items-center gap-3">
                <img src="/logo.svg" alt="Logo" className="h-7 w-auto rounded-md ring-1 ring-ring" />
              </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block text-right">
              <div className="text-sm font-medium">{profile?.username ?? "User"}</div>
              <div className="text-xs text-subtext">{profile?.referrerCode ?? "-"}</div>
            </div>
          <ConnectWallet />
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white shadow-sm ring-1 ring-primary/20">
              {initials}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="hidden lg:block">
            <div className="rounded-3xl bg-card p-3 shadow-sm ring-1 ring-ring">
              <div className="px-3 py-2 text-xs font-medium text-subtext">Menu</div>
              <div className="mt-1 grid gap-1">
                <button
                  type="button"
                  onClick={() => { setActive("home"); setWalletOpen(false); }}
                  className={`flex items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                    active === "home" ? "bg-muted text-foreground" : "text-subtext hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span>Home</span>
                  {active === "home" ? <span className="text-primary">●</span> : null}
                </button>
                <button
                  type="button"
                  onClick={() => { setActive("network"); setWalletOpen(false); }}
                  className={`flex items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                    active === "network" ? "bg-muted text-foreground" : "text-subtext hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span>My Network</span>
                  {active === "network" ? <span className="text-primary">●</span> : null}
                </button>
                <div className="grid gap-1">
                  <button
                    type="button"
                    onClick={() => { setActive("wallet"); setWalletOpen((v) => !v); }}
                    className={`flex items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                      active === "wallet" ? "bg-muted text-foreground" : "text-subtext hover:bg-muted hover:text-foreground"
                    }`}
                    aria-expanded={walletOpen}
                  >
                    <span>Wallet</span>
                    <span className={`transition-transform ${walletOpen ? "rotate-90" : ""}`}>›</span>
                  </button>
                  <div className={`ml-2 grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ${walletOpen && active === "wallet" ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                    <div className="min-h-0 overflow-hidden rounded-2xl bg-background ring-1 ring-ring">
                      {[
                        { key: "deposit", label: "Deposit Funds" },
                        { key: "depositHistory", label: "Deposit History" },
                        { key: "withdraw", label: "Withdraw Funds" },
                        { key: "withdrawHistory", label: "Withdrawal History" },
                        { key: "p2pTransfer", label: "P2P Fund Transfer" },
                        { key: "p2pHistory", label: "P2P History" },
                      ].map((i) => (
                        <button
                          key={i.key}
                          type="button"
                          onClick={() => { setActive("wallet"); setWalletTab(i.key as typeof walletTab); }}
                          className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition ${
                            active === "wallet" && walletTab === (i.key as typeof walletTab)
                              ? "bg-muted text-foreground"
                              : "text-subtext hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          <span>{i.label}</span>
                          {active === "wallet" && walletTab === (i.key as typeof walletTab) ? <span className="text-primary">●</span> : null}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setActive("settings"); setWalletOpen(false); }}
                  className={`flex items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                    active === "settings" ? "bg-muted text-foreground" : "text-subtext hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span>Settings</span>
                  {active === "settings" ? <span className="text-primary">●</span> : null}
                </button>
              </div>
            </div>

            <div className="mt-6 rounded-3xl bg-card p-5 shadow-sm ring-1 ring-ring">
              <div className="text-xs text-subtext">Referral Link</div>
              <div className="mt-2 truncate rounded-2xl bg-muted px-4 py-3 text-sm text-foreground ring-1 ring-ring">
                {origin ? `${origin}/?ref=${profile?.referrerCode ?? ""}` : profile?.referrerCode ?? "-"}
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (profile?.status !== "admin" && directReferrals >= 2) {
                    setUiMessage("You can add only 2 direct referrals. To invite further, copy your team members’ referral links.");
                    setTimeout(() => setUiMessage(""), 3000);
                    return;
                  }
                  
                  const text = origin ? `${origin}/?ref=${profile?.referrerCode ?? ""}` : profile?.referrerCode ?? "";
                  try {
                    await navigator.clipboard.writeText(text);
                    setLinkCopied(true);
                    toast.success("Invite link copied");
                    setTimeout(() => setLinkCopied(false), 1200);
                  } catch {
                    setUiMessage("Copy failed");
                    toast.error("Copy failed");
                    setTimeout(() => setUiMessage(""), 1200);
                  }
                }}
                disabled={profile?.status !== "admin" && directReferrals >= 2}
                className={`mt-3 inline-flex h-11 w-full items-center justify-center rounded-2xl text-sm font-semibold shadow-sm ring-1 transition ${
                  profile?.status !== "admin" && directReferrals >= 2 
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed ring-gray-300" 
                    : linkCopied 
                    ? "bg-green-500 text-white ring-green-500/20"
                    : "bg-primary text-white ring-primary/20 hover:bg-primary/90"
                }`}
              >
                {linkCopied ? "Link Copied" : (profile?.status !== "admin" && directReferrals >= 2) ? "Max Reached (2/2)" : "Copy Link"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-muted px-5 text-sm font-medium text-foreground ring-1 ring-ring transition hover:bg-secondary"
            >
              Logout
            </button>
          </aside>
          
          <div className="lg:hidden">
            <div className="rounded-3xl bg-card p-5 shadow-sm ring-1 ring-ring">
              <div className="text-xs text-subtext">Referral Link</div>
              <div className="mt-2 truncate rounded-2xl bg-muted px-4 py-3 text-sm text-foreground ring-1 ring-ring">
                {origin ? `${origin}/?ref=${profile?.referrerCode ?? ""}` : profile?.referrerCode ?? "-"}
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (profile?.status !== "admin" && directReferrals >= 2) {
                    setUiMessage("You can add only 2 direct referrals. To invite further, copy your team members’ referral links.");
                    setTimeout(() => setUiMessage(""), 3000);
                    return;
                  }
                  const text = origin ? `${origin}/?ref=${profile?.referrerCode ?? ""}` : profile?.referrerCode ?? "";
                  try {
                    await navigator.clipboard.writeText(text);
                    setLinkCopied(true);
                    toast.success("Invite link copied");
                    setTimeout(() => setLinkCopied(false), 1200);
                  } catch {
                    setUiMessage("Copy failed");
                    toast.error("Copy failed");
                    setTimeout(() => setUiMessage(""), 1200);
                  }
                }}
                disabled={profile?.status !== "admin" && directReferrals >= 2}
                className={`mt-3 inline-flex h-11 w-full items-center justify-center rounded-2xl text-sm font-semibold shadow-sm ring-1 transition ${
                  profile?.status !== "admin" && directReferrals >= 2 
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed ring-gray-300" 
                    : linkCopied 
                    ? "bg-green-500 text-white ring-green-500/20"
                    : "bg-primary text-white ring-primary/20 hover:bg-primary/90"
                }`}
                aria-label="Copy referral link"
              >
                {linkCopied ? "Link Copied" : (profile?.status !== "admin" && directReferrals >= 2) ? "Max Reached (2/2)" : "Copy Link"}
              </button>
            </div>
          </div>

          <main className="space-y-6">
            {active === "home" && (
              <>
                <div className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-ring sm:p-8">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-sm text-subtext">Welcome back</div>
                      <div className="mt-1 text-2xl font-semibold">{profile?.username ?? "User"}</div>
                      <div className="mt-2 max-w-2xl text-sm text-subtext">
                        {uiMessage ? uiMessage : "Live data enabled: dashboard, referrals, transactions, notifications."}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSupportOpen(true)}
                        className="inline-flex items-center justify-center rounded-full bg-card px-5 py-2 text-sm font-medium text-foreground shadow-sm ring-1 ring-ring transition hover:bg-muted w-full sm:w-auto"
                      >
                        Support
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Direct Referrals" value={String(directReferrals)} hint="Level 1 count" />
                    <StatCard label="Active Level" value={`L${level}`} hint="Current depth" />
                    <StatCard label="Total Team (L1-33)" value={String(refStats?.total ?? 0)} hint="All levels (payouts L1-20)" />
                    <StatCard label="Wallet Balance" value={String(profile?.balance ?? 0)} hint={profile?.status ?? ""} />
                  </div>
                </div>

                {teamNodes && (
                  <div className="grid gap-6 xl:grid-cols-1">
                    {uplineNodes && uplineNodes.length > 0 ? (
                      <div className="rounded-2xl bg-card p-5 ring-1 ring-ring">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold">My Upline</div>
                          <div className="text-xs text-subtext">{uplineNodes.length} nodes</div>
                        </div>
                        <div className="mt-4 overflow-x-auto rounded-2xl ring-1 ring-ring">
                          <div className="flex items-center gap-3 px-4 py-3 text-sm">
                            {uplineNodes.map((n: any, idx: number) => (
                              <div key={n.id} className="flex items-center gap-3">
                                <div className={`inline-flex h-9 items-center justify-center rounded-full px-3 text-xs font-medium ring-1 ${
                                  n.email === COMPANY_ADMIN_EMAIL ? "bg-primary text-white ring-primary/20" : "bg-muted text-foreground ring-ring"
                                }`}>
                                  {n.email === COMPANY_ADMIN_EMAIL ? "Admin" : `L${uplineNodes.length - idx - 1}`} · {n.email === COMPANY_ADMIN_EMAIL ? "Admin" : n.username}
                                </div>
                                {idx < uplineNodes.length - 1 ? <span className="text-subtext">→</span> : null}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="mt-3 text-xs text-subtext">
                          You are connected in the admin tree. The path shows from top to you.
                        </div>
                      </div>
                    ) : null}
                    <div className="rounded-2xl bg-card p-5 ring-1 ring-ring">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold">My Team Tree</div>
                        <div className="text-xs text-subtext">{teamNodes.length} members</div>
                      </div>
                      <div className="mt-4">
                        <NetworkTree nodes={teamNodes} onCopyMessage={setUiMessage} />
                      </div>
                    </div>
                    
                    <div className="rounded-2xl bg-card p-5 ring-1 ring-ring">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold">My Team List</div>
                        <div className="text-xs text-subtext">{teamNodes.length} members</div>
                      </div>
                      <div className="mt-4 max-h-[260px] overflow-auto rounded-2xl ring-1 ring-ring">
                        <div className="divide-y divide-[color:var(--ring)]">
                          {teamNodes.slice(0, 40).map((n: any) => (
                            <div key={n.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                              <div className="truncate">
                                <div className="font-medium text-foreground">{n.email === COMPANY_ADMIN_EMAIL ? "Admin" : n.username}</div>
                                <div className="text-xs text-subtext">L{n.depth} · {n.referrerCode}</div>
                              </div>
                              <div className="text-xs text-subtext">{n.email}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {active === "network" && teamNodes && (
              <div className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-ring">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm text-subtext">My Network</div>
                    <div className="mt-1 text-2xl font-semibold">Level-wise View</div>
                    <div className="mt-2 max-w-2xl text-sm text-subtext">
                      Expand a level to see user IDs. Showing up to L{maxLevel}.
                    </div>
                  </div>
                  <div className="text-xs text-subtext">{teamNodes.length} members</div>
                </div>
                <div className="mt-6">
                  {Array.from({ length: maxLevel }, (_, i) => i + 1).map((lvl) => {
                    const members = teamNodes.filter((n: any) => Number(n.depth) === lvl);
                    const count = refStats?.levels?.[String(lvl)] ?? members.length;
                    const open = openLevels.includes(lvl);
                    return (
                      <div key={lvl} className="mb-3 rounded-2xl bg-muted ring-1 ring-ring">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenLevels((prev) => (prev.includes(lvl) ? prev.filter((x) => x !== lvl) : [...prev, lvl]))
                          }
                          className="flex w-full items-center justify-between px-5 py-4 text-left"
                          aria-expanded={open}
                        >
                          <span className="text-base font-medium text-foreground">Level {lvl}</span>
                          <span className="rounded-full bg-card px-3 py-1 text-sm text-subtext ring-1 ring-ring">
                            {count} {count === 1 ? "member" : "members"}
                          </span>
                        </button>
                        <div
                          className={`px-5 transition-[max-height,opacity] duration-300 ease-out ${
                            open ? "max-h-60 opacity-100" : "max-h-0 opacity-0"
                          }`}
                        >
                          <div className="pb-4 text-sm text-subtext">
                            {members.length === 0 ? (
                              <div className="rounded-xl bg-card px-3 py-2 text-xs ring-1 ring-ring">No members at this level</div>
                            ) : (
                              members.slice(0, 200).map((n: any) => (
                                <div key={n.id} className="flex items-center justify-between py-1">
                                  <span className="font-medium text-foreground">{n.username ?? "-"}</span>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        await navigator.clipboard.writeText(String(n.referrerCode ?? ""));
                                        setUiMessage("Referral code copied");
                                        toast.success("Referral code copied");
                                        setTimeout(() => setUiMessage(""), 1200);
                                      } catch {
                                        setUiMessage("Copy failed");
                                        toast.error("Copy failed");
                                        setTimeout(() => setUiMessage(""), 1200);
                                      }
                                    }}
                                    className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1 text-xs text-subtext ring-1 ring-ring transition hover:text-foreground"
                                    aria-label="Copy referral code"
                                  >
                                    <span>{n.referrerCode ?? "-"}</span>
                                    <span className="text-primary">Copy</span>
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {active === "wallet" && (
              <>
                {walletTab === "deposit" && (
                  <WalletSection 
                    balance={profile?.balance ?? 0} 
                    userId={profile?.id ?? ""}
                  />
                )}
                {walletTab === "depositHistory" && (
                  <div className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-ring">
                    <div className="text-sm font-semibold">Deposit History</div>
                    <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-ring">
                      <div className="grid grid-cols-[1.2fr_1fr_0.8fr] gap-2 bg-muted px-4 py-3 text-xs font-medium text-subtext">
                        <div>Hash</div>
                        <div>Amount</div>
                        <div>Date</div>
                      </div>
                      <div className="divide-y divide-[color:var(--ring)]">
                        {recentTransactions
                          .filter((t: any) => String(t.type).toLowerCase() === "deposit")
                          .map((t: any) => (
                            <div key={t.id} className="grid grid-cols-[1.2fr_1fr_0.8fr] gap-2 px-4 py-4 text-sm">
                              <div className="truncate">{t.txHash ?? "-"}</div>
                              <div className="font-medium text-foreground">{String(t.amount)}</div>
                              <div className="text-subtext">{String(t.createdAt).slice(0, 10)}</div>
                            </div>
                          ))}
                        {recentTransactions.filter((t: any) => String(t.type).toLowerCase() === "deposit").length === 0 && (
                          <div className="px-4 py-6 text-center text-sm text-subtext">No deposits yet</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {walletTab === "withdraw" && <WithdrawSection />}
                {walletTab === "withdrawHistory" && (
                  <div className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-ring">
                    <div className="text-sm font-semibold">Withdrawal History</div>
                    <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-ring">
                      <div className="grid grid-cols-[1.2fr_1fr_0.8fr] gap-2 bg-muted px-4 py-3 text-xs font-medium text-subtext">
                        <div>Hash</div>
                        <div>Amount</div>
                        <div>Date</div>
                      </div>
                      <div className="divide-y divide-[color:var(--ring)]">
                        {recentTransactions
                          .filter((t: any) => String(t.type).toLowerCase() === "withdrawal")
                          .map((t: any) => (
                            <div key={t.id} className="grid grid-cols-[1.2fr_1fr_0.8fr] gap-2 px-4 py-4 text-sm">
                              <div className="truncate">{t.txHash ?? "-"}</div>
                              <div className="font-medium text-foreground">{String(t.amount)}</div>
                              <div className="text-subtext">{String(t.createdAt).slice(0, 10)}</div>
                            </div>
                          ))}
                        {recentTransactions.filter((t: any) => String(t.type).toLowerCase() === "withdrawal").length === 0 && (
                          <div className="px-4 py-6 text-center text-sm text-subtext">No withdrawals yet</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {walletTab === "p2pTransfer" && (
                  <div className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-ring">
                    <div className="text-sm font-semibold">P2P Fund Transfer</div>
                    <div className="mt-2 text-sm text-subtext">Coming soon</div>
                  </div>
                )}
                {walletTab === "p2pHistory" && (
                  <div className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-ring">
                    <div className="text-sm font-semibold">P2P History</div>
                    <div className="mt-2 text-sm text-subtext">Coming soon</div>
                  </div>
                )}
              </>
            )}

            {active === "settings" && (
              <SettingsSection />
            )}
          </main>
        </div>
      </div>

      {supportOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8" role="dialog" aria-modal="true" aria-label="Support">
          <button type="button" onClick={() => setSupportOpen(false)} className="absolute inset-0 bg-black/30" aria-label="Close" />
          <div className="relative w-full max-w-md rounded-3xl bg-card p-6 shadow-xl ring-1 ring-ring">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-2xl font-semibold">Support</div>
                <div className="mt-1 text-sm text-subtext">Submit payment or account related issues.</div>
              </div>
              <button
                type="button"
                onClick={() => setSupportOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground ring-1 ring-ring transition hover:bg-secondary"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form
              className="mt-6 grid gap-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setUiMessage("");
                try {
                  const res = await fetch("/api/user/support", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ subject: supportSubject, message: supportMessage }),
                  });
                  const data = await res.json();
                  if (!res.ok) {
                    setUiMessage(typeof data?.error === "string" ? data.error : "Support failed");
                    toast.error("Support failed");
                    return;
                  }
                  setUiMessage("Ticket submitted");
                  toast.success("Ticket submitted");
                  setSupportSubject("");
                  setSupportMessage("");
                  setSupportOpen(false);
                } catch {
                  setUiMessage("Support failed");
                  toast.error("Support failed");
                }
              }}
            >
              <label className="grid gap-2">
                <span className="text-sm font-medium text-foreground">Subject</span>
                <input
                  required
                  value={supportSubject}
                  onChange={(e) => setSupportSubject(e.target.value)}
                  className="h-11 w-full rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Payment pending"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-foreground">Message</span>
                <textarea
                  required
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                  className="min-h-[120px] w-full rounded-2xl bg-background px-4 py-3 text-sm text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Details..."
                />
              </label>
              <button
                type="submit"
                className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-white shadow-sm ring-1 ring-primary/20 transition hover:bg-primary/90"
              >
                Submit
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="absolute inset-0 bg-black/30"
            aria-label="Close menu"
          />
          <div className="absolute left-0 top-0 h-full w-[84%] max-w-xs bg-card shadow-xl ring-1 ring-ring">
            <div className="flex items-center justify-between px-4 py-4">
              <div className="text-sm font-semibold">Menu</div>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground ring-1 ring-ring hover:bg-secondary"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="px-3 pb-4">
              {[
                { key: "home", label: "Home" },
                { key: "network", label: "My Network" },
                { key: "wallet", label: "Wallet" },
                { key: "settings", label: "Settings" },
              ].map((i) => (
                <button
                  key={i.key}
                  type="button"
                  onClick={() => {
                    setActive(i.key as typeof active);
                    setMobileNavOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                    active === i.key ? "bg-muted text-foreground" : "text-subtext hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span>{i.label}</span>
                  {active === i.key ? <span className="text-primary">●</span> : null}
                </button>
              ))}
            </div>
            <div className="px-4 pb-6">
              <div className="text-xs text-subtext">Referral Link</div>
              <div className="mt-2 truncate rounded-2xl bg-muted px-4 py-3 text-sm text-foreground ring-1 ring-ring">
                https://mlm.local/ref/USR-1024
              </div>
              <button
                type="button"
                className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-white shadow-sm ring-1 ring-primary/20 transition hover:bg-primary/90"
              >
                Copy Link
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
